import { randomUUID } from 'node:crypto';
import { Request } from 'express';
import jwt, { JwtPayload, TokenExpiredError } from 'jsonwebtoken';
import { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getAuthSessionConfig, AuthSessionConfig } from './appConfig';
import { getRequestIp } from './staticIpAuth';
import { getRedis } from './redis';

export type SafeAuthUser = {
  id: string;
  email: string;
  role: string;
  name: string;
  unit: string | null;
  businessLocationId: string | null;
};

export type StoredAuthSession = {
  id: string;
  userId: string;
  deviceId: string | null;
  deviceName: string | null;
  ip: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  tokenTtlMinutes: number;
  renewGraceMinutes: number;
};

export type AuthJwtPayload = JwtPayload & SafeAuthUser & {
  sub: string;
  sid: string;
  typ: 'access';
};

export type IssuedAuthSession = {
  token: string;
  tokenExpiresAt: string;
  tokenExpiresInSeconds: number;
  session: StoredAuthSession;
  sessionExpiresInSeconds: number;
};

export class AuthSessionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function sessionKey(sessionId: string): string {
  return `auth:session:${sessionId}`;
}

function userSessionsKey(userId: string): string {
  return `auth:user:${userId}:sessions`;
}

function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'fallback-secret';
}

function secondsUntil(isoDate: string): number {
  return Math.max(1, Math.ceil((new Date(isoDate).getTime() - Date.now()) / 1000));
}

function sessionWindowSeconds(config: AuthSessionConfig): number {
  return (config.tokenTtlMinutes + config.renewGraceMinutes) * 60;
}

export function userPayload(user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'unit' | 'businessLocationId'>): SafeAuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    unit: user.unit,
    businessLocationId: user.businessLocationId,
  };
}

function signToken(user: SafeAuthUser, sessionId: string, config: AuthSessionConfig): { token: string; expiresAt: string; expiresInSeconds: number } {
  const expiresInSeconds = config.tokenTtlMinutes * 60;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  const payload: AuthJwtPayload = {
    ...user,
    sub: user.id,
    sid: sessionId,
    typ: 'access',
  };
  return {
    token: jwt.sign(payload, jwtSecret(), { expiresIn: expiresInSeconds }),
    expiresAt,
    expiresInSeconds,
  };
}

function parseSession(raw: string | null): StoredAuthSession | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAuthSession;
  } catch {
    return null;
  }
}

async function readSession(sessionId: string): Promise<StoredAuthSession | null> {
  const redis = await getRedis();
  return parseSession(await redis.get(sessionKey(sessionId)));
}

async function writeSession(session: StoredAuthSession): Promise<void> {
  const redis = await getRedis();
  await redis.set(sessionKey(session.id), JSON.stringify(session), { EX: secondsUntil(session.expiresAt) });
  await redis.sAdd(userSessionsKey(session.userId), session.id);
  await redis.expire(userSessionsKey(session.userId), secondsUntil(session.expiresAt));
}

export async function getActiveUserSessions(userId: string): Promise<StoredAuthSession[]> {
  const redis = await getRedis();
  const ids = await redis.sMembers(userSessionsKey(userId));
  const sessions: StoredAuthSession[] = [];
  const now = Date.now();

  for (const id of ids) {
    const session = await readSession(id);
    if (!session || new Date(session.expiresAt).getTime() <= now) {
      await redis.sRem(userSessionsKey(userId), id);
      continue;
    }
    sessions.push(session);
  }

  return sessions.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
}

export async function revokeSession(sessionId: string): Promise<void> {
  const redis = await getRedis();
  const session = await readSession(sessionId);
  await redis.del(sessionKey(sessionId));
  if (session) await redis.sRem(userSessionsKey(session.userId), sessionId);
}

export async function revokeUserSessions(userId: string, predicate?: (session: StoredAuthSession) => boolean): Promise<void> {
  const sessions = await getActiveUserSessions(userId);
  for (const session of sessions) {
    if (!predicate || predicate(session)) await revokeSession(session.id);
  }
}

export function sanitizeSession(session: StoredAuthSession) {
  return {
    id: session.id,
    deviceId: session.deviceId,
    deviceName: session.deviceName,
    ip: session.ip,
    userAgent: session.userAgent,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  };
}

export async function createAuthSession(args: {
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'unit' | 'businessLocationId'>;
  req: Request;
  deviceId?: string | null;
  deviceName?: string | null;
}): Promise<IssuedAuthSession> {
  const config = await getAuthSessionConfig();
  const now = new Date();
  const session: StoredAuthSession = {
    id: randomUUID(),
    userId: args.user.id,
    deviceId: args.deviceId?.trim() || null,
    deviceName: args.deviceName?.trim().slice(0, 120) || null,
    ip: getRequestIp(args.req, true),
    userAgent: typeof args.req.headers['user-agent'] === 'string' ? args.req.headers['user-agent'] : null,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + sessionWindowSeconds(config) * 1000).toISOString(),
    tokenTtlMinutes: config.tokenTtlMinutes,
    renewGraceMinutes: config.renewGraceMinutes,
  };
  await writeSession(session);

  const token = signToken(userPayload(args.user), session.id, config);
  return {
    token: token.token,
    tokenExpiresAt: token.expiresAt,
    tokenExpiresInSeconds: token.expiresInSeconds,
    session,
    sessionExpiresInSeconds: secondsUntil(session.expiresAt),
  };
}

function verifyJwt(token: string, ignoreExpiration = false): AuthJwtPayload {
  try {
    const payload = jwt.verify(token, jwtSecret(), { ignoreExpiration }) as AuthJwtPayload;
    if (!payload?.sid || !payload?.sub) {
      throw new AuthSessionError(401, 'InvalidToken', 'Token không hợp lệ.');
    }
    return payload;
  } catch (error) {
    if (error instanceof AuthSessionError) throw error;
    if (error instanceof TokenExpiredError) {
      throw new AuthSessionError(401, 'TokenExpired', 'Token đã hết hạn.');
    }
    throw new AuthSessionError(401, 'InvalidToken', 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  }
}

async function resolveActiveSessionAndUser(payload: AuthJwtPayload): Promise<{ user: SafeAuthUser; session: StoredAuthSession }> {
  const session = await readSession(payload.sid);
  if (!session || session.userId !== payload.sub || new Date(session.expiresAt).getTime() <= Date.now()) {
    throw new AuthSessionError(401, 'SessionExpired', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) {
    await revokeSession(session.id);
    throw new AuthSessionError(401, 'UserInactive', 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.');
  }

  const touchedSession = { ...session, lastSeenAt: new Date().toISOString() };
  await writeSession(touchedSession);
  return { user: userPayload(user), session: touchedSession };
}

export async function verifyAccessToken(token: string): Promise<{ user: SafeAuthUser; session: StoredAuthSession }> {
  const payload = verifyJwt(token);
  return resolveActiveSessionAndUser(payload);
}

export async function renewAccessToken(token: string): Promise<{ user: SafeAuthUser; issued: IssuedAuthSession }> {
  const payload = verifyJwt(token, true);
  const { user, session } = await resolveActiveSessionAndUser(payload);
  const config = await getAuthSessionConfig();
  const now = new Date();
  const renewedSession: StoredAuthSession = {
    ...session,
    lastSeenAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + sessionWindowSeconds(config) * 1000).toISOString(),
    tokenTtlMinutes: config.tokenTtlMinutes,
    renewGraceMinutes: config.renewGraceMinutes,
  };
  await writeSession(renewedSession);
  const signed = signToken(user, renewedSession.id, config);
  return {
    user,
    issued: {
      token: signed.token,
      tokenExpiresAt: signed.expiresAt,
      tokenExpiresInSeconds: signed.expiresInSeconds,
      session: renewedSession,
      sessionExpiresInSeconds: secondsUntil(renewedSession.expiresAt),
    },
  };
}

export function authResponse(user: SafeAuthUser, issued: IssuedAuthSession) {
  return {
    token: issued.token,
    user,
    expiresAt: issued.tokenExpiresAt,
    expiresInSeconds: issued.tokenExpiresInSeconds,
    session: {
      ...sanitizeSession(issued.session),
      expiresInSeconds: issued.sessionExpiresInSeconds,
    },
  };
}
