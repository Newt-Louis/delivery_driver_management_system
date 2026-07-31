import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate } from '../middleware/auth';
import { authLoginLimiter } from '../middleware/rateLimit';
import { AuthFormRequest } from '../modules/auth/authFormRequest';
import { sendDomainError } from '../modules/http/domainErrorResponse';
import * as authService from '../modules/auth/authService';

const router = Router();

function authRequestContext(req: Request): authService.AuthRequestContext {
  return {
    headers: req.headers as Record<string, string | string[] | undefined>,
    socketRemoteAddress: req.socket.remoteAddress,
    ip: req.ip ?? '',
    hostname: req.hostname,
    protocol: req.protocol,
    host: req.get('host') ?? '',
    forwardedProto: req.headers['x-forwarded-proto'],
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null,
  };
}

async function respond(res: Response, action: Promise<unknown>, successStatus = 200) {
  try {
    res.status(successStatus).json(await action);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}

router.post('/login', authLoginLimiter, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseLogin(req.body);
  try {
    const result = await authService.login(body, authRequestContext(req));
    res.status('faceIdRequired' in result ? 202 : 200).json(result);
  } catch (error) {
    if (sendDomainError(res, error)) return;
    throw error;
  }
}));

router.post('/face-id/register/options', authenticate, asyncHandler(async (req, res) => {
  await respond(res, authService.faceRegistrationOptions(req.user!, authRequestContext(req)));
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  await respond(res, authService.currentUser(req.user!, req.authSession));
}));

router.post('/renew', authLoginLimiter, asyncHandler(async (req, res) => {
  const token = AuthFormRequest.parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  await respond(res, authService.renew(token));
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  await respond(res, authService.logout(req.authSession));
}));

router.post('/face-id/register/verify', authenticate, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseFaceRegisterVerify(req.body);
  await respond(res, authService.verifyFaceRegistrationForUser(req.user!, body), 201);
}));

router.post('/face-id/authenticate/options', authLoginLimiter, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseFaceOptions(req.body);
  await respond(res, authService.faceAuthenticationOptions(body, authRequestContext(req)));
}));

router.post('/face-id/authenticate/verify', authLoginLimiter, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseFaceAuthVerify(req.body);
  await respond(res, authService.verifyFaceAuthenticationForLogin(body, authRequestContext(req)));
}));

export default router;
