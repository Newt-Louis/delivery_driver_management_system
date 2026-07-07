import { Request, Response, NextFunction } from 'express';
import type { SocketScope } from '../socket';
import { AuthSessionError, StoredAuthSession, verifyAccessToken } from '../services/authSession';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  unit: string | null;
  businessLocationId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      authSession?: StoredAuthSession;
      scope?: SocketScope;
    }
  }
}

// Verify JWT then confirm user still exists in DB.
// Catches stale tokens after seed/user deletion without requiring client re-login UX friction.
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const token = header.slice(7);
  verifyAccessToken(token)
    .then(({ user, session }) => {
      req.user = user;
      req.authSession = session;
      next();
    })
    .catch((error) => {
      if (error instanceof AuthSessionError) {
        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      next(error);
    });
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Bạn không có quyền thực hiện thao tác này.' });
      return;
    }
    next();
  };
}

/**
 * Enforce businessLocationId scope for non-SUPERADMIN roles.
 * - SUPERADMIN: optional scope from query params (or undefined = full system access)
 * - Non-SUPERADMIN: forced scope from user.businessLocationId (query params ignored for businessLocationId)
 *
 * Sets req.scope = { businessLocationId?, unitConfigId? }
 */
export function enforceScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const queryUnitConfigId = typeof req.query.unitConfigId === 'string' ? req.query.unitConfigId : undefined;

  if (req.user.role === 'SUPERADMIN') {
    req.scope = {
      businessLocationId: typeof req.query.businessLocationId === 'string' ? req.query.businessLocationId : undefined,
      unitConfigId: queryUnitConfigId,
    };
  } else {
    if (!req.user.businessLocationId) {
      res.status(403).json({ error: 'Tài khoản chưa được gán khu vực hoạt động.' });
      return;
    }
    req.scope = {
      businessLocationId: req.user.businessLocationId,
      unitConfigId: queryUnitConfigId,
    };
  }
  next();
}

/**
 * Public/read-only scope resolver for routes intentionally available without login
 * (waiting screen, public queue reads). It only trusts explicit query scope.
 */
export function resolvePublicScope(req: Request, _res: Response, next: NextFunction): void {
  const businessLocationId = typeof req.query.businessLocationId === 'string'
    ? req.query.businessLocationId
    : undefined;
  const unitConfigId = typeof req.query.unitConfigId === 'string'
    ? req.query.unitConfigId
    : undefined;

  req.scope = { businessLocationId, unitConfigId };
  next();
}

/**
 * Verify a resource belongs to the user's enforced scope.
 * For SUPERADMIN: always allowed (full system access).
 * For non-SUPERADMIN: resource's businessLocationId must match user's scope.
 *
 * @returns true if allowed, false if access denied (response already sent)
 */
export function enforceResourceScope(
  req: Request,
  res: Response,
  resourceBusinessLocationId: string | null | undefined,
): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (req.user.role === 'SUPERADMIN') return true;
  if (!resourceBusinessLocationId) {
    res.status(403).json({ error: 'Không thể xác định khu vực của tài nguyên này.' });
    return false;
  }
  if (resourceBusinessLocationId !== req.user.businessLocationId) {
    res.status(403).json({ error: 'Tài nguyên không thuộc khu vực của bạn.' });
    return false;
  }
  return true;
}
