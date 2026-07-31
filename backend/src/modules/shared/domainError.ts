export type DomainErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'conflict'
  | 'unprocessable';

export class DomainError extends Error {
  constructor(
    public readonly kind: DomainErrorKind,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

export const domainError = {
  unauthorized: (message = 'Unauthorized', details?: Record<string, unknown>) => (
    new DomainError('unauthorized', message, 'Unauthorized', details)
  ),
  forbidden: (message: string, details?: Record<string, unknown>) => (
    new DomainError('forbidden', message, 'Forbidden', details)
  ),
  notFound: (message = 'Not found', details?: Record<string, unknown>) => (
    new DomainError('not_found', message, 'NotFound', details)
  ),
  badRequest: (message: string, code = 'BadRequest', details?: Record<string, unknown>) => (
    new DomainError('bad_request', message, code, details)
  ),
  conflict: (message: string, code = 'Conflict', details?: Record<string, unknown>) => (
    new DomainError('conflict', message, code, details)
  ),
  unprocessable: (message: string, code = 'Unprocessable', details?: Record<string, unknown>) => (
    new DomainError('unprocessable', message, code, details)
  ),
};
