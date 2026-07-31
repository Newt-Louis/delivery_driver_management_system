import type { Response } from 'express';
import { DomainError, isDomainError } from '../shared/domainError';

function statusForDomainError(error: DomainError): number {
  switch (error.kind) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
      return 409;
    case 'unprocessable':
      return 422;
    case 'bad_request':
    default:
      return 400;
  }
}

export function sendDomainError(res: Response, error: unknown): boolean {
  if (!isDomainError(error)) return false;

  res.status(statusForDomainError(error)).json({
    error: error.code ?? error.name,
    message: error.message,
    ...(error.details ?? {}),
  });
  return true;
}
