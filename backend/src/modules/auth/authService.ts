import { Request } from 'express';
import bcrypt from 'bcryptjs';
import type { SafeAuthUser, StoredAuthSession } from '../../services/authSession';
import {
  authResponse,
  createAuthSession,
  getActiveUserSessions,
  renewAccessToken,
  revokeSession,
  revokeUserSessions,
  sanitizeSession,
  userPayload,
} from '../../services/authSession';
import {
  getAuthSessionConfig,
  getFaceIdAuthConfig,
  getStaticIpAuthConfig,
  roleIsConfigured,
} from '../../services/appConfig';
import { getRequestIp, ipIsAllowedByConfig } from '../../services/staticIpAuth';
import {
  createFaceAuthenticationOptions,
  createFaceRegistrationOptions,
  verifyFaceAuthentication,
  verifyFaceRegistration,
} from '../../services/faceIdAuth';
import { getUserUnitPermissions, roleRequiresUnitPermission } from '../../services/unitPermission';
import type {
  FaceAuthVerifyRequest,
  FaceOptionsRequest,
  FaceRegisterVerifyRequest,
  LoginRequest,
} from './authFormRequest';
import { countActiveFaceCredentials, findUserByEmail } from './authRepository';

type AuthRouteResult = {
  statusCode: number;
  body: unknown;
};

function response(statusCode: number, body: unknown): AuthRouteResult {
  return { statusCode, body };
}

async function unitPermissionsFor(user: Pick<SafeAuthUser, 'id' | 'role'>) {
  return roleRequiresUnitPermission(user.role)
    ? await getUserUnitPermissions(user.id)
    : undefined;
}

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

export async function login(body: LoginRequest, req: Request): Promise<AuthRouteResult> {
  const user = await findUserByEmail(body.email);
  if (!user || !user.isActive) {
    return response(401, { error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    return response(401, { error: 'Invalid credentials' });
  }

  const staticIpPolicy = await checkStaticIpLoginPolicy(req, user);
  if (staticIpPolicy.denied) {
    return response(403, {
      error: 'StaticIpRequired',
      message: staticIpPolicy.denied.message,
      ip: staticIpPolicy.denied.ip,
    });
  }

  const faceIdConfig = await getFaceIdAuthConfig();
  const faceCredentialCount = await countActiveFaceCredentials(user.id);
  const faceIdApplies = faceIdConfig.enabled && roleIsConfigured(user.role, faceIdConfig.roles);

  if (faceIdApplies && (faceCredentialCount > 0 || faceIdConfig.requireRegisteredCredential)) {
    if (faceCredentialCount === 0) {
      return response(403, {
        error: 'FaceIdRequired',
        message: 'Tài khoản này bắt buộc dùng Face ID nhưng chưa có thiết bị được đăng ký.',
      });
    }

    return response(202, {
      faceIdRequired: true,
      user: userPayload(user),
      ...(await createFaceAuthenticationOptions(user, req, faceIdConfig)),
    });
  }

  const sessionConfig = await getAuthSessionConfig();
  const activeSessions = sessionConfig.singleSessionPerUser
    ? await getActiveUserSessions(user.id)
    : [];
  const deviceId = body.deviceId?.trim() || null;
  const sameDeviceSessions = activeSessions.filter((session) => session.deviceId && session.deviceId === deviceId);
  const conflictingSessions = activeSessions.filter((session) => !session.deviceId || session.deviceId !== deviceId);

  if (sessionConfig.singleSessionPerUser && conflictingSessions.length > 0 && !body.force) {
    return response(409, {
      error: 'ActiveSessionExists',
      message: 'Tài khoản này đang đăng nhập ở thiết bị khác.',
      activeSessions: conflictingSessions.map(sanitizeSession),
    });
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

  return response(200, {
    ...authResponse(userPayload(user), issued),
    unitPermissions: await unitPermissionsFor(user),
    authPolicy: {
      staticIpEnabled: staticIpPolicy.enabled,
      faceIdEnabled: faceIdConfig.enabled,
    },
  });
}

export async function currentUser(user: SafeAuthUser, session?: StoredAuthSession | null): Promise<AuthRouteResult> {
  return response(200, {
    user,
    unitPermissions: await unitPermissionsFor(user),
    session: session ? sanitizeSession(session) : null,
  });
}

export async function renew(token: string): Promise<AuthRouteResult> {
  const { user, issued } = await renewAccessToken(token);
  return response(200, authResponse(user, issued));
}

export async function logout(session?: StoredAuthSession | null): Promise<AuthRouteResult> {
  if (session) await revokeSession(session.id);
  return response(200, { ok: true });
}

export async function faceRegistrationOptions(user: SafeAuthUser, req: Request): Promise<AuthRouteResult> {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    return response(409, { error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật cho tài khoản này.' });
  }

  return response(200, await createFaceRegistrationOptions(user, req, faceIdConfig));
}

export async function verifyFaceRegistrationForUser(
  user: SafeAuthUser,
  body: FaceRegisterVerifyRequest,
): Promise<AuthRouteResult> {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    return response(409, { error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật cho tài khoản này.' });
  }

  const credential = await verifyFaceRegistration({
    userId: user.id,
    clientDataJSON: body.credential.response.clientDataJSON,
    attestationObject: body.credential.response.attestationObject,
    deviceName: body.deviceName,
    transports: body.credential.response.transports,
  });

  return response(201, {
    id: credential.id,
    credentialId: credential.credentialId,
    deviceName: credential.deviceName,
    createdAt: credential.createdAt,
  });
}

export async function faceAuthenticationOptions(
  body: FaceOptionsRequest,
  req: Request,
): Promise<AuthRouteResult> {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled) {
    return response(409, { error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật.' });
  }

  const user = await findUserByEmail(body.email);
  if (!user || !user.isActive || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    return response(404, { error: 'FaceIdUnavailable', message: 'Tài khoản chưa hỗ trợ Face ID.' });
  }

  return response(200, await createFaceAuthenticationOptions(user, req, faceIdConfig));
}

export async function verifyFaceAuthenticationForLogin(
  body: FaceAuthVerifyRequest,
  req: Request,
): Promise<AuthRouteResult> {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled) {
    return response(409, { error: 'FaceIdDisabled', message: 'Face ID/WebAuthn chưa được bật.' });
  }

  const user = await verifyFaceAuthentication({
    credentialId: body.credential.rawId ?? body.credential.id,
    clientDataJSON: body.credential.response.clientDataJSON,
    authenticatorData: body.credential.response.authenticatorData,
    signature: body.credential.response.signature,
  });

  if (!roleIsConfigured(user.role, faceIdConfig.roles)) {
    return response(403, { error: 'FaceIdUnavailable', message: 'Role này chưa được bật Face ID.' });
  }

  const staticIpPolicy = await checkStaticIpLoginPolicy(req, user);
  if (staticIpPolicy.denied) {
    return response(403, {
      error: 'StaticIpRequired',
      message: staticIpPolicy.denied.message,
      ip: staticIpPolicy.denied.ip,
    });
  }

  const issued = await createAuthSession({
    user,
    req,
    deviceId: null,
    deviceName: 'Face ID/WebAuthn',
  });

  return response(200, {
    ...authResponse(userPayload(user), issued),
    unitPermissions: await unitPermissionsFor(user),
  });
}
