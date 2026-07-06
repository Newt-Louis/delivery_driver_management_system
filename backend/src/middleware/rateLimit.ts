import { Request, Response, NextFunction } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
  keyGenerator?: (req: Request) => string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function defaultKey(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function cleanupExpiredBuckets(now: number): void {
  if (buckets.size < 10_000) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const rawKey = options.keyGenerator?.(req) ?? defaultKey(req);
    const key = `${options.name}:${rawKey}`;
    const existing = buckets.get(key);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

    bucket.count++;
    buckets.set(key, bucket);

    const remaining = Math.max(options.max - bucket.count, 0);
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: 'Too many requests',
        message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
        retryAfterSeconds,
      });
      return;
    }

    next();
  };
}

export const authLoginLimiter = rateLimit({
  name: 'auth-login',
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
});

export const staffActionLimiter = rateLimit({
  name: 'staff-action',
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => `${req.ip}:${String(req.params?.code ?? '').toUpperCase()}`,
});

export const publicWriteLimiter = rateLimit({
  name: 'public-write',
  windowMs: 60_000,
  max: 180,
});

export const publicLookupLimiter = rateLimit({
  name: 'public-lookup',
  windowMs: 60_000,
  max: 120,
});

export const publicReadLimiter = rateLimit({
  name: 'public-read',
  windowMs: 60_000,
  max: 240,
});
