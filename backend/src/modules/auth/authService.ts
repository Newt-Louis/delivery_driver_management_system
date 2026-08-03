import bcrypt from 'bcryptjs';
import type { AuthRequestInfo, SafeAuthUser, StoredAuthSession } from '../../services/authSession';
import {
  authResponse,
  createAuthSession,
  getActiveUserSessions,
  renewAccessToken,
  refreshAuthUserCache,
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
import { getRequestIpFromSource, ipIsAllowedByConfig, type RequestIpSource } from '../../services/staticIpAuth';
import {
  createFaceAuthenticationOptions,
  createFaceRegistrationOptions,
  verifyFaceAuthentication,
  verifyFaceRegistration,
  type WebAuthnRequestContext,
} from '../../services/faceIdAuth';
import { domainError } from '../shared/domainError';
import type {
  FaceAuthVerifyRequest,
  FaceOptionsRequest,
  FaceRegisterVerifyRequest,
  LoginRequest,
} from './authFormRequest';
import { countActiveFaceCredentials, findUserByEmail } from './authRepository';

export type AuthRequestContext = AuthRequestInfo & RequestIpSource & WebAuthnRequestContext;

async function checkStaticIpLoginPolicy(context: AuthRequestContext, user: { role: string }) {
  const staticIpConfig = await getStaticIpAuthConfig();
  const enabled = staticIpConfig.enabled && roleIsConfigured(user.role, staticIpConfig.roles);
  if (!enabled) return { enabled, denied: null };

  const ip = getRequestIpFromSource(context, staticIpConfig.trustProxyHeader);
  if (!ipIsAllowedByConfig(ip, staticIpConfig)) {
    return {
      enabled,
      denied: { ip, message: 'IP hiện tại không nằm trong danh sách IP nội bộ được phép đăng nhập.' },
    };
  }
  return { enabled, denied: null };
}

export async function login(body: LoginRequest, context: AuthRequestContext) {
  const user = await findUserByEmail(body.email);
  if (!user || !user.isActive || user.deletedAt) {
    throw domainError.unauthorized('Invalid credentials', { error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) {
    throw domainError.unauthorized('Invalid credentials', { error: 'Invalid credentials' });
  }

  const staticIpPolicy = await checkStaticIpLoginPolicy(context, user);
  if (staticIpPolicy.denied) {
    throw domainError.forbidden(staticIpPolicy.denied.message, {
      error: 'StaticIpRequired',
      ip: staticIpPolicy.denied.ip,
    });
  }

  const faceIdConfig = await getFaceIdAuthConfig();
  const faceCredentialCount = await countActiveFaceCredentials(user.id);
  const faceIdApplies = faceIdConfig.enabled && roleIsConfigured(user.role, faceIdConfig.roles);

  if (faceIdApplies && (faceCredentialCount > 0 || faceIdConfig.requireRegisteredCredential)) {
    if (faceCredentialCount === 0) {
      throw domainError.forbidden('Tài khoản này bắt buộc dùng Face ID nhưng chưa có thiết bị được đăng ký.', {
        error: 'FaceIdRequired',
      });
    }

    return {
      faceIdRequired: true,
      user: userPayload(user),
      ...(await createFaceAuthenticationOptions(user, context, faceIdConfig)),
    };
  }

  const sessionConfig = await getAuthSessionConfig();
  const activeSessions = sessionConfig.singleSessionPerUser
    ? await getActiveUserSessions(user.id)
    : [];
  const deviceId = body.deviceId?.trim() || null;
  const sameDeviceSessions = activeSessions.filter((session) => session.deviceId && session.deviceId === deviceId);
  const conflictingSessions = activeSessions.filter((session) => !session.deviceId || session.deviceId !== deviceId);

  if (sessionConfig.singleSessionPerUser && conflictingSessions.length > 0 && !body.force) {
    throw domainError.conflict('Tài khoản này đang đăng nhập ở thiết bị khác.', 'ActiveSessionExists', {
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
    requestInfo: context,
    deviceId,
    deviceName: body.deviceName ?? null,
  });

  const safeUser = await refreshAuthUserCache(user.id) ?? userPayload(user);
  return {
    ...authResponse(safeUser, issued),
    unitPermissions: safeUser.operationUnits,
    authPolicy: {
      staticIpEnabled: staticIpPolicy.enabled,
      faceIdEnabled: faceIdConfig.enabled,
    },
  };
}

export async function currentUser(user: SafeAuthUser, session?: StoredAuthSession | null) {
  return {
    user,
    unitPermissions: user.operationUnits,
    session: session ? sanitizeSession(session) : null,
  };
}

export async function renew(token: string) {
  const { user, issued } = await renewAccessToken(token);
  return authResponse(user, issued);
}

export async function logout(session?: StoredAuthSession | null) {
  if (session) await revokeSession(session.id);
  return { ok: true };
}

export async function faceRegistrationOptions(user: SafeAuthUser, context: AuthRequestContext) {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    throw domainError.conflict('Face ID/WebAuthn chưa được bật cho tài khoản này.', 'FaceIdDisabled');
  }

  return createFaceRegistrationOptions(user, context, faceIdConfig);
}

export async function verifyFaceRegistrationForUser(
  user: SafeAuthUser,
  body: FaceRegisterVerifyRequest,
) {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    throw domainError.conflict('Face ID/WebAuthn chưa được bật cho tài khoản này.', 'FaceIdDisabled');
  }

  const credential = await verifyFaceRegistration({
    userId: user.id,
    clientDataJSON: body.credential.response.clientDataJSON,
    attestationObject: body.credential.response.attestationObject,
    deviceName: body.deviceName,
    transports: body.credential.response.transports,
  });

  return {
    id: credential.id,
    credentialId: credential.credentialId,
    deviceName: credential.deviceName,
    createdAt: credential.createdAt,
  };
}

export async function faceAuthenticationOptions(
  body: FaceOptionsRequest,
  context: AuthRequestContext,
) {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled) {
    throw domainError.conflict('Face ID/WebAuthn chưa được bật.', 'FaceIdDisabled');
  }

  const user = await findUserByEmail(body.email);
  if (!user || !user.isActive || user.deletedAt || !roleIsConfigured(user.role, faceIdConfig.roles)) {
    throw domainError.notFound('Tài khoản chưa hỗ trợ Face ID.', { error: 'FaceIdUnavailable' });
  }

  return createFaceAuthenticationOptions(user, context, faceIdConfig);
}

export async function verifyFaceAuthenticationForLogin(
  body: FaceAuthVerifyRequest,
  context: AuthRequestContext,
) {
  const faceIdConfig = await getFaceIdAuthConfig();
  if (!faceIdConfig.enabled) {
    throw domainError.conflict('Face ID/WebAuthn chưa được bật.', 'FaceIdDisabled');
  }

  const user = await verifyFaceAuthentication({
    credentialId: body.credential.rawId ?? body.credential.id,
    clientDataJSON: body.credential.response.clientDataJSON,
    authenticatorData: body.credential.response.authenticatorData,
    signature: body.credential.response.signature,
  });

  if (!roleIsConfigured(user.role, faceIdConfig.roles)) {
    throw domainError.forbidden('Role này chưa được bật Face ID.', { error: 'FaceIdUnavailable' });
  }

  const staticIpPolicy = await checkStaticIpLoginPolicy(context, user);
  if (staticIpPolicy.denied) {
    throw domainError.forbidden(staticIpPolicy.denied.message, {
      error: 'StaticIpRequired',
      ip: staticIpPolicy.denied.ip,
    });
  }

  const issued = await createAuthSession({
    user,
    requestInfo: context,
    deviceId: null,
    deviceName: 'Face ID/WebAuthn',
  });

  const safeUser = await refreshAuthUserCache(user.id) ?? userPayload(user);
  return {
    ...authResponse(safeUser, issued),
    unitPermissions: safeUser.operationUnits,
  };
}
