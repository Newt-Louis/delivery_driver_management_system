import { Router, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate } from '../middleware/auth';
import { authLoginLimiter } from '../middleware/rateLimit';
import { AuthFormRequest } from '../modules/auth/authFormRequest';
import * as authService from '../modules/auth/authService';

const router = Router();

function sendAuthResult(res: Response, result: { statusCode: number; body: unknown }) {
  res.status(result.statusCode).json(result.body);
}

router.post('/login', authLoginLimiter, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseLogin(req.body);
  sendAuthResult(res, await authService.login(body, req));
}));

router.post('/face-id/register/options', authenticate, asyncHandler(async (req, res) => {
  sendAuthResult(res, await authService.faceRegistrationOptions(req.user!, req));
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  sendAuthResult(res, await authService.currentUser(req.user!, req.authSession));
}));

router.post('/renew', authLoginLimiter, asyncHandler(async (req, res) => {
  const token = AuthFormRequest.parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  sendAuthResult(res, await authService.renew(token));
}));

router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  sendAuthResult(res, await authService.logout(req.authSession));
}));

router.post('/face-id/register/verify', authenticate, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseFaceRegisterVerify(req.body);
  sendAuthResult(res, await authService.verifyFaceRegistrationForUser(req.user!, body));
}));

router.post('/face-id/authenticate/options', authLoginLimiter, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseFaceOptions(req.body);
  sendAuthResult(res, await authService.faceAuthenticationOptions(body, req));
}));

router.post('/face-id/authenticate/verify', authLoginLimiter, asyncHandler(async (req, res) => {
  const body = AuthFormRequest.parseFaceAuthVerify(req.body);
  sendAuthResult(res, await authService.verifyFaceAuthenticationForLogin(body, req));
}));

export default router;
