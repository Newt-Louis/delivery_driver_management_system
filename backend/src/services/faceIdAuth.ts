import crypto from 'node:crypto';
import { Request } from 'express';
import { Prisma, User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { FaceIdAuthConfig } from './appConfig';

type SafeUser = Pick<User, 'id' | 'email' | 'name'>;

type WebAuthnClientData = {
  type: string;
  challenge: string;
  origin: string;
};

type CoseKey = Map<number, unknown>;

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function base64url(buffer: Buffer): string {
  return buffer.toString('base64url');
}

function decodeBase64url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function sha256(data: Buffer | string): Buffer {
  return crypto.createHash('sha256').update(data).digest();
}

function getRpId(req: Request, config: FaceIdAuthConfig): string {
  if (config.rpId) return config.rpId;
  return req.hostname.split(':')[0];
}

function getExpectedOrigin(req: Request, config: FaceIdAuthConfig): string {
  if (config.origin) return config.origin;
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
  return `${Array.isArray(proto) ? proto[0] : proto}://${req.get('host')}`;
}

function parseClientDataJSON(encoded: string): WebAuthnClientData {
  return JSON.parse(decodeBase64url(encoded).toString('utf8')) as WebAuthnClientData;
}

class CborReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  read(): unknown {
    const initial = this.buffer[this.offset++];
    const major = initial >> 5;
    const additional = initial & 0x1f;
    const length = this.readLength(additional);

    if (major === 0) return length;
    if (major === 1) return -1 - length;
    if (major === 2) return this.readBytes(length);
    if (major === 3) return this.readBytes(length).toString('utf8');
    if (major === 4) {
      const arr: unknown[] = [];
      for (let i = 0; i < length; i += 1) arr.push(this.read());
      return arr;
    }
    if (major === 5) {
      const map = new Map<unknown, unknown>();
      for (let i = 0; i < length; i += 1) map.set(this.read(), this.read());
      return map;
    }
    if (major === 6) return this.read();
    if (major === 7) {
      if (additional === 20) return false;
      if (additional === 21) return true;
      if (additional === 22) return null;
    }
    throw new Error('Unsupported CBOR data');
  }

  private readLength(additional: number): number {
    if (additional < 24) return additional;
    if (additional === 24) return this.buffer[this.offset++];
    if (additional === 25) {
      const value = this.buffer.readUInt16BE(this.offset);
      this.offset += 2;
      return value;
    }
    if (additional === 26) {
      const value = this.buffer.readUInt32BE(this.offset);
      this.offset += 4;
      return value;
    }
    throw new Error('Unsupported CBOR length');
  }

  private readBytes(length: number): Buffer {
    const out = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return out;
  }
}

function cborDecode(buffer: Buffer): unknown {
  return new CborReader(buffer).read();
}

function coseToJwk(coseKey: Buffer): { jwk: crypto.JsonWebKey; alg: 'ES256' | 'RS256' } {
  const decoded = cborDecode(coseKey);
  if (!(decoded instanceof Map)) throw new Error('Invalid COSE key');
  const key = decoded as CoseKey;
  const kty = key.get(1);
  const alg = key.get(3);

  if (kty === 2 && alg === -7) {
    const x = key.get(-2);
    const y = key.get(-3);
    if (!Buffer.isBuffer(x) || !Buffer.isBuffer(y)) throw new Error('Invalid EC2 key');
    return {
      alg: 'ES256',
      jwk: {
        kty: 'EC',
        crv: 'P-256',
        x: base64url(x),
        y: base64url(y),
        ext: true,
      },
    };
  }

  if (kty === 3 && alg === -257) {
    const n = key.get(-1);
    const e = key.get(-2);
    if (!Buffer.isBuffer(n) || !Buffer.isBuffer(e)) throw new Error('Invalid RSA key');
    return {
      alg: 'RS256',
      jwk: {
        kty: 'RSA',
        n: base64url(n),
        e: base64url(e),
        ext: true,
      },
    };
  }

  throw new Error('Unsupported credential public key algorithm');
}

function parseAttestationObject(encoded: string) {
  const attestationObject = cborDecode(decodeBase64url(encoded));
  if (!(attestationObject instanceof Map)) throw new Error('Invalid attestation object');
  const authData = attestationObject.get('authData');
  if (!Buffer.isBuffer(authData)) throw new Error('Missing authData');

  const credentialIdLength = authData.readUInt16BE(53);
  const credentialIdStart = 55;
  const credentialIdEnd = credentialIdStart + credentialIdLength;
  const credentialId = authData.subarray(credentialIdStart, credentialIdEnd);
  const coseKey = authData.subarray(credentialIdEnd);
  const signCount = authData.readUInt32BE(33);
  return { credentialId, signCount, publicKey: coseToJwk(coseKey) };
}

function assertClientData(args: {
  clientDataJSON: string;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedType: 'webauthn.create' | 'webauthn.get';
}) {
  const clientData = parseClientDataJSON(args.clientDataJSON);
  if (clientData.challenge !== args.expectedChallenge) throw new Error('Challenge mismatch');
  if (clientData.origin !== args.expectedOrigin) throw new Error('Origin mismatch');
  if (clientData.type !== args.expectedType) throw new Error('WebAuthn type mismatch');
}

function verifyRpId(authenticatorData: Buffer, rpId: string) {
  const rpIdHash = authenticatorData.subarray(0, 32);
  if (!crypto.timingSafeEqual(rpIdHash, sha256(rpId))) {
    throw new Error('RP ID mismatch');
  }
}

async function createChallenge(args: {
  type: 'face_registration' | 'face_authentication';
  userId?: string;
  metadata: Prisma.InputJsonValue;
}) {
  const challenge = base64url(crypto.randomBytes(32));
  const row = await prisma.authChallenge.create({
    data: {
      userId: args.userId,
      type: args.type,
      challenge,
      metadata: args.metadata,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  return row;
}

async function consumeChallenge(challenge: string, type: string) {
  const row = await prisma.authChallenge.findFirst({
    where: {
      challenge,
      type,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) throw new Error('Challenge expired or not found');
  await prisma.authChallenge.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
  return row;
}

export async function createFaceRegistrationOptions(user: SafeUser, req: Request, config: FaceIdAuthConfig) {
  const rpId = getRpId(req, config);
  const origin = getExpectedOrigin(req, config);
  const challenge = await createChallenge({
    type: 'face_registration',
    userId: user.id,
    metadata: { rpId, origin },
  });

  return {
    challengeId: challenge.id,
    publicKey: {
      challenge: challenge.challenge,
      rp: { name: config.rpName, id: rpId },
      user: {
        id: base64url(Buffer.from(user.id)),
        name: user.email,
        displayName: user.name,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: config.userVerification,
        residentKey: 'preferred',
      },
      timeout: CHALLENGE_TTL_MS,
      attestation: 'none',
    },
  };
}

export async function verifyFaceRegistration(args: {
  userId: string;
  clientDataJSON: string;
  attestationObject: string;
  deviceName?: string | null;
  transports?: string[];
}) {
  const clientData = parseClientDataJSON(args.clientDataJSON);
  const challenge = await consumeChallenge(clientData.challenge, 'face_registration');
  if (challenge.userId !== args.userId) throw new Error('Challenge user mismatch');
  const metadata = challenge.metadata as { rpId?: string; origin?: string } | null;
  assertClientData({
    clientDataJSON: args.clientDataJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: metadata?.origin ?? '',
    expectedType: 'webauthn.create',
  });

  const parsed = parseAttestationObject(args.attestationObject);
  const credentialId = base64url(parsed.credentialId);
  const credential = await prisma.faceCredential.upsert({
    where: { credentialId },
    create: {
      userId: args.userId,
      credentialId,
      publicKey: parsed.publicKey as unknown as Prisma.InputJsonValue,
      signCount: parsed.signCount,
      deviceName: args.deviceName ?? null,
      transports: args.transports ?? [],
    },
    update: {
      userId: args.userId,
      publicKey: parsed.publicKey as unknown as Prisma.InputJsonValue,
      signCount: parsed.signCount,
      deviceName: args.deviceName ?? null,
      transports: args.transports ?? [],
      isActive: true,
    },
  });

  return credential;
}

export async function createFaceAuthenticationOptions(user: SafeUser, req: Request, config: FaceIdAuthConfig) {
  const credentials = await prisma.faceCredential.findMany({
    where: { userId: user.id, isActive: true },
    select: { credentialId: true, transports: true },
  });
  if (credentials.length === 0) throw new Error('No Face ID credentials registered');

  const rpId = getRpId(req, config);
  const origin = getExpectedOrigin(req, config);
  const challenge = await createChallenge({
    type: 'face_authentication',
    userId: user.id,
    metadata: { rpId, origin },
  });

  return {
    challengeId: challenge.id,
    publicKey: {
      challenge: challenge.challenge,
      rpId,
      allowCredentials: credentials.map((credential) => ({
        type: 'public-key',
        id: credential.credentialId,
        transports: credential.transports,
      })),
      timeout: CHALLENGE_TTL_MS,
      userVerification: config.userVerification,
    },
  };
}

export async function verifyFaceAuthentication(args: {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
}) {
  const clientData = parseClientDataJSON(args.clientDataJSON);
  const challenge = await consumeChallenge(clientData.challenge, 'face_authentication');
  const metadata = challenge.metadata as { rpId?: string; origin?: string } | null;
  assertClientData({
    clientDataJSON: args.clientDataJSON,
    expectedChallenge: challenge.challenge,
    expectedOrigin: metadata?.origin ?? '',
    expectedType: 'webauthn.get',
  });

  const credential = await prisma.faceCredential.findUnique({
    where: { credentialId: args.credentialId },
    include: { user: true },
  });
  if (!credential || !credential.isActive || credential.userId !== challenge.userId || !credential.user.isActive) {
    throw new Error('Credential not found or inactive');
  }

  const authenticatorData = decodeBase64url(args.authenticatorData);
  verifyRpId(authenticatorData, metadata?.rpId ?? '');

  const clientDataHash = sha256(decodeBase64url(args.clientDataJSON));
  const signedData = Buffer.concat([authenticatorData, clientDataHash]);
  const stored = credential.publicKey as unknown as { jwk: crypto.JsonWebKey; alg: 'ES256' | 'RS256' };
  const keyObject = crypto.createPublicKey({ key: stored.jwk, format: 'jwk' });
  const verified = crypto.verify('sha256', signedData, keyObject, decodeBase64url(args.signature));
  if (!verified) throw new Error('Face ID signature verification failed');

  const signCount = authenticatorData.readUInt32BE(33);
  await prisma.faceCredential.update({
    where: { id: credential.id },
    data: { signCount, lastUsedAt: new Date() },
  });

  return credential.user;
}
