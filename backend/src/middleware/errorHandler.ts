import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      message: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    });
    return;
  }

  if (err instanceof Error) {
    const statusCode = (err as Error & { statusCode?: number }).statusCode;
    if (statusCode && statusCode >= 400 && statusCode < 600) {
      res.status(statusCode).json({ error: err.message });
      return;
    }

    console.error('Unhandled error:', err.message);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal Server Error', message: 'Unknown error' });
}
