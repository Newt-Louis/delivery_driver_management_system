import { ReceivingUnit } from '@prisma/client';
import { helperFunctions } from '../../helperFunction';
import type { ReportQuery, ReportRange } from './reportTypes';

export class ReportRequestError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

function parseReceivingUnit(value: unknown): ReceivingUnit | undefined {
  const input = helperFunctions.stringValue(value);
  if (!input) return undefined;
  const unit = helperFunctions.enumValue(input, Object.values(ReceivingUnit));
  if (!unit) throw new ReportRequestError('unit không hợp lệ.');
  return unit;
}

function parseDateRange(query: Record<string, unknown>): ReportRange {
  const from = helperFunctions.stringValue(query.from);
  const to = helperFunctions.stringValue(query.to);
  const gte = from ? helperFunctions.parseDate(from) : new Date(Date.now() - 30 * 86400_000);
  const lte = to ? helperFunctions.parseDate(to, true) : new Date();

  if (!gte) throw new ReportRequestError('from không hợp lệ.');
  if (!lte) throw new ReportRequestError('to không hợp lệ.');
  if (gte.getTime() > lte.getTime()) {
    throw new ReportRequestError('from không được lớn hơn to.');
  }

  return { gte, lte };
}

function parseReportQuery(query: Record<string, unknown>): ReportQuery {
  return {
    range: parseDateRange(query),
    unit: parseReceivingUnit(query.unit),
  };
}

export const ReportFormRequest = {
  parseReportQuery,
};
