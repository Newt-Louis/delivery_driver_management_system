import { Request, Response, NextFunction } from 'express';
import type { SocketScope } from '../socket';
import { AuthSessionError, StoredAuthSession, verifyAccessToken } from '../services/authSession';
import type { AuthPermissionUnit } from '../domain/permissions';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
  unit: string | null;
  businessLocationId: string | null;
  operationUnits: AuthPermissionUnit[];
  manageableUnits: AuthPermissionUnit[];
  unitPermissions: AuthPermissionUnit[];
  capabilities: string[];
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
 * Enforce the operational BusinessLocation stored on the authenticated profile.
 * For SUPERADMIN this value comes from the selected location in the Redis session;
 * for other roles it is their assigned location.
 *
 * Sets req.scope = { businessLocationId?, unitConfigId? }
 */
export function enforceScope(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const businessLocationId = req.user.businessLocationId ?? undefined;
  const queryBusinessLocationId = typeof req.query.businessLocationId === 'string'
    ? req.query.businessLocationId
    : undefined;
  const queryUnitConfigId = typeof req.query.unitConfigId === 'string'
    ? req.query.unitConfigId
    : undefined;

  if (!businessLocationId) {
    res.status(403).json({
      error: req.user.role === 'SUPERADMIN'
        ? 'SUPERADMIN chưa chọn khu vực vận hành.'
        : 'Tài khoản chưa được gán khu vực hoạt động.',
    });
    return;
  }

  if (queryBusinessLocationId && queryBusinessLocationId !== businessLocationId) {
    res.status(403).json({ error: 'BusinessLocation yêu cầu không khớp khu vực vận hành hiện tại.' });
    return;
  }

  if (queryUnitConfigId) {
    const unitInScope = req.user.operationUnits.some((unit) => (
      unit.isActive
      && unit.id === queryUnitConfigId
      && unit.businessLocationId === businessLocationId
    ));
    if (!unitInScope) {
      res.status(403).json({ error: 'UnitConfig yêu cầu không thuộc khu vực vận hành hiện tại.' });
      return;
    }
  }

  req.scope = { businessLocationId, unitConfigId: queryUnitConfigId };
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
 * Resource businessLocationId must match the current authenticated operational scope.
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
