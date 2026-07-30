import { helperFunctions } from '../../helperFunction';

export class AnalyticsRequestError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

function parseConfigId(value: unknown): string {
  const id = helperFunctions.stringValue(value);
  if (!id) throw new AnalyticsRequestError('id không hợp lệ.');
  return id;
}

export const AnalyticsFormRequest = {
  parseConfigId,
};
