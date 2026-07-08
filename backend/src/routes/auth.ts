import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate } from '../middleware/auth';
import { authLoginLimiter } from '../middleware/rateLimit';
import {
  getAuthSessionConfig,
  getFaceIdAuthConfig,
  getStaticIpAuthConfig,
  roleIsConfigured,
} from '../services/appConfig';
import { getRequestIp, ipIsAllowedByConfig } from '../services/staticIpAuth';
import {
  createFaceAuthenticationOptions,
  createFaceRegistrationOptions,
  verifyFaceAuthentication,
  verifyFaceRegistration,
} from '../services/faceIdAuth';
import {
  authResponse,
  createAuthSession,
  getActiveUserSessions,
  renewAccessToken,
  revokeSession,
  revokeUserSessions,
  sanitizeSession,
  userPayload,
} from '../services/authSession';
import { getUserUnitPermissions, roleRequiresUnitPermission } from '../services/unitPermission';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().trim().max(120).nullable().optional(),
  deviceName: z.string().trim().nullable().optional(),
  force: z.boolean().optional(),
});

const faceOptionsSchema = z.object({
  email: z.string().email(),
});

const faceRegisterVerifySchema = z.object({
  credential: z.object({
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1),
      transports: z.array(z.string()).optional(),
    }),
  }),
  deviceName: z.string().max(100).nullable().optional(),
});

const faceAuthVerifySchema = z.object({
  credential: z.object({
    id: z.string().min(1),
    rawId: z.string().optional(),
    response: z.object({
      clientDataJSON: z.string().min(1),
      authenticatorData: z.string().min(1),
      signature: z.string().min(1),
    }),
  }),
});

async function checkStaticIpLoginPolicy(req: Request, user: { role: string }) {
  const staticIpConfig = await getStaticIpAuthConfig();
  const enabled = staticIpConfig.enabled && roleIsConfigured(user.role, staticIpConfig.roles);
  if (!enabled) return { enabled, denied: null };

  const ip = getRequestIp(req, staticIpConfig.trustProxyHeader);
  if (!ipIsAllowedByConfig(ip, staticIpConfig)) {
    return {
      enabled,
      denied: { ip, message: 'IP hiện tại không nằm trong danh sách IP nội bộ được phép đăng nhập.' },
    };
  }
  return { enabled, denied: null };
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

router.post('/login', authLoginLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const staticIpPolicy = await checkStaticIpLoginPolicy(req, user);
  if (staticIpPolicy.denied) {
    res.status(403).json({
      error: 'StaticIpRequired',
      message: staticIpPolicy.denied.message,
      ip: staticIpPolicy.denied.ip,
    });
    return;
  }

  const faceIdConfig = await getFaceIdAuthConfig();
  const faceCredentialCount = await prisma.faceCredential.count({
    where: { userId: user.id, isActive: true },
  });
  const faceIdApplies = faceIdConfig.enabled && roleIsConfigured(user.role, faceIdConfig.roles);

  if (faceIdApplies && (faceCredentialCount > 0 || faceIdConfig.requireRegisteredCredential)) {
    if (faceCredentialCount === 0) {
      res.status(403).json({
        error: 'FaceIdRequired',
        message: 'Tài khoản này bắt buộc dùng Face ID nhưng chưa có thiết bị được đăng ký.',
      });
      return;
    }

    res.status(202).json({
      faceIdRequired: true,
      user: userPayload(user),
      ...(await createFaceAuthenticationOptions(user, req, faceIdConfig)),
    });
    return;
  }

  const sessionConfig = await getAuthSessionConfig();
  const activeSessions = sessionConfig.singleSessionPerUser
    ? await getActiveUserSessions(user.id)
    : [];
  const deviceId = body.deviceId?.trim() || null;
  const sameDeviceSessions = activeSessions.filter((session) => session.deviceId && session.deviceId === deviceId);
  const conflictingSessions = activeSessions.filter((session) => !session.deviceId || session.deviceId !== deviceId);

  if (sessionConfig.singleSessionPerUser && conflictingSessions.length > 0 && !body.force) {
    res.status(409).json({
      error: 'ActiveSessionExists',
      message: 'Tài khoản này đang đăng nhập ở thiết bị khác.',
      activeSessions: conflictingSessions.map(sanitizeSession),
    });
    return;
  }

  if (sessionConfig.singleSessionPerUser && body.force) {
    await revokeUserSessions(user.id);
  } else if (sameDeviceSessions.length > 0) {
    await revokeUserSessions(user.id, (session) => session.deviceId === deviceId);
  }

  const issued = await createAuthSession({
    user,
    req,
    deviceId,
    deviceName: body.deviceName ?? null,
  });

  res.json({
    ...authResponse(userPayload(user), issued),
    unitPermissions: roleRequiresUnitPermission(user.role)
      ? await getUserUnitPermissions(user.id)
      : undefined,
    authPolicy: {
      staticIpEnabled: staticIpPolicy.enabled,
      faceIdEnabled: faceIdConfig.enabled,
    },
  });
}));

router.post('/face-id/register/options', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled || !roleIsConfigured(req.user!.role, faceIdConfig.roles)) {
    res.status(409).json({ error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật cho tài khoản này.' });
    return;
  }

  res.json(await createFaceRegistrationOptions(req.user!, req, faceIdConfig));
}));

router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  res.json({
    user: req.user,
    unitPermissions: roleRequiresUnitPermission(req.user!.role)
      ? await getUserUnitPermissions(req.user!.id)
      : undefined,
    session: req.authSession ? sanitizeSession(req.authSession) : null,
  });
}));

router.post('/renew', authLoginLimiter, asyncHandler(async (req: Request, res: Response) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const { user, issued } = await renewAccessToken(token);
  res.json(authResponse(user, issued));
}));

router.post('/logout', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (req.authSession) await revokeSession(req.authSession.id);
  res.json({ ok: true });
}));

router.post('/face-id/register/verify', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled || !roleIsConfigured(req.user!.role, faceIdConfig.roles)) {
    res.status(409).json({ error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật cho tài khoản này.' });
    return;
  }

  const body = faceRegisterVerifySchema.parse(req.body);
  const credential = await verifyFaceRegistration({
    userId: req.user!.id,
    clientDataJSON: body.credential.response.clientDataJSON,
    attestationObject: body.credential.response.attestationObject,
    deviceName: body.deviceName,
    transports: body.credential.response.transports,
  });
  res.status(201).json({
    id: credential.id,
    credentialId: credential.credentialId,
    deviceName: credential.deviceName,
    createdAt: credential.createdAt,
  });
}));

router.post('/face-id/authenticate/options', authLoginLimiter, asyncHandler(async (req: Request, res: Response) => {
  const body = faceOptionsSchema.parse(req.body);
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled) {
    res.status(409).json({ error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.isActive || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    res.status(404).json({ error: 'FaceIdUnavailable', message: 'Tài khoản chưa hỗ trợ Face ID.' });
    return;
  }

  res.json(await createFaceAuthenticationOptions(user, req, faceIdConfig));
}));

router.post('/face-id/authenticate/verify', authLoginLimiter, asyncHandler(async (req: Request, res: Response) => {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled) {
    res.status(409).json({ error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật.' });
    return;
  }

  const body = faceAuthVerifySchema.parse(req.body);
  const user = await verifyFaceAuthentication({
    credentialId: body.credential.rawId ?? body.credential.id,
    clientDataJSON: body.credential.response.clientDataJSON,
    authenticatorData: body.credential.response.authenticatorData,
    signature: body.credential.response.signature,
  });

  if (!roleIsConfigured(user.role, faceIdConfig.roles)) {
    res.status(403).json({ error: 'FaceIdUnavailable', message: 'Role này chưa được bật Face ID.' });
    return;
  }

  const staticIpPolicy = await checkStaticIpLoginPolicy(req, user);
  if (staticIpPolicy.denied) {
    res.status(403).json({
      error: 'StaticIpRequired',
      message: staticIpPolicy.denied.message,
      ip: staticIpPolicy.denied.ip,
    });
    return;
  }

  const issued = await createAuthSession({
    user,
    req,
    deviceId: null,
    deviceName: 'Face ID/WebAuthn',
  });
  res.json({
    ...authResponse(userPayload(user), issued),
    unitPermissions: roleRequiresUnitPermission(user.role)
      ? await getUserUnitPermissions(user.id)
      : undefined,
  });
}));

export default router;
