import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
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
  let payload: AuthUser;
  try {
    const secret = process.env.JWT_SECRET ?? 'fallback-secret';
    payload = jwt.verify(token, secret) as AuthUser;
  } catch {
    res.status(401).json({ error: 'Unauthorized', message: 'Token không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.' });
    return;
  }

  // Verify user still exists in DB (handles reseed / deleted accounts)
  prisma.user
    .findUnique({ where: { id: payload.id } })
    .then((user) => {
      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng xuất và đăng nhập lại.',
        });
        return;
      }
      // Always use fresh data from DB, not stale JWT payload
      req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
      next();
    })
    .catch(next);
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
