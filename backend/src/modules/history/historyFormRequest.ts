import {
  AuditActorType,
  DeliveryHistoryFinalStatus,
  GoodsType,
  ReceivingUnit,
  VehicleType,
} from '@prisma/client';
import { helperFunctions } from '../../helperFunction';

export class HistoryRequestError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

const DELIVERY_SORT_FIELDS = new Set([
  'registrationCode',
  'registeredAt',
  'checkinTime',
  'calledTime',
  'receivingStartTime',
  'completedTime',
  'archivedAt',
  'finalStatus',
  'receivingUnit',
  'goodsType',
  'vehicleType',
  'ticketNumber',
  'callCount',
]);

const AUDIT_SORT_FIELDS = new Set([
  'createdAt',
  'actorType',
  'action',
  'targetType',
]);

function parseEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined {
  const input = helperFunctions.stringValue(value);
  if (!input) return undefined;
  const parsed = helperFunctions.enumValue(input, allowed);
  if (!parsed) throw new HistoryRequestError(`${field} không hợp lệ.`);
  return parsed;
}

function parseOptionalDate(value: unknown, field: string, endOfDay = false): Date | undefined {
  if (!helperFunctions.stringValue(value)) return undefined;
  const parsed = helperFunctions.optionalDateValue(value, endOfDay);
  if (!parsed) throw new HistoryRequestError(`${field} không hợp lệ.`);
  return parsed;
}

function parsePage(value: unknown): number {
  const parsed = helperFunctions.parsePositiveInt(value, 1, 10_000);
  if (parsed === null) throw new HistoryRequestError('page phải là số nguyên dương.');
  return parsed;
}

function parseLimit(value: unknown): number {
  const parsed = helperFunctions.parsePositiveInt(value, 50, 200);
  if (parsed === null) throw new HistoryRequestError('limit phải là số nguyên dương.');
  return parsed;
}

function parseDeliveryHistoryQuery(query: Record<string, unknown>) {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sortField: helperFunctions.sortField(query.sortField, DELIVERY_SORT_FIELDS, 'registeredAt'),
    sortDir: helperFunctions.sortDir(query.sortDir),
    from: parseOptionalDate(query.from, 'from'),
    to: parseOptionalDate(query.to, 'to', true),
    finalStatus: parseEnum(query.finalStatus, Object.values(DeliveryHistoryFinalStatus), 'finalStatus'),
    receivingUnit: parseEnum(query.receivingUnit, Object.values(ReceivingUnit), 'receivingUnit'),
    goodsType: parseEnum(query.goodsType, Object.values(GoodsType), 'goodsType'),
    vehicleType: parseEnum(query.vehicleType, Object.values(VehicleType), 'vehicleType'),
    search: helperFunctions.stringValue(query.search),
  };
}

function parseAuditHistoryQuery(query: Record<string, unknown>) {
  const page = parsePage(query.page);
  const limit = parseLimit(query.limit);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
    sortField: helperFunctions.sortField(query.sortField, AUDIT_SORT_FIELDS, 'createdAt'),
    sortDir: helperFunctions.sortDir(query.sortDir),
    from: parseOptionalDate(query.from, 'from'),
    to: parseOptionalDate(query.to, 'to', true),
    actorType: parseEnum(query.actorType, Object.values(AuditActorType), 'actorType'),
    action: helperFunctions.stringValue(query.action),
    targetType: helperFunctions.stringValue(query.targetType),
    search: helperFunctions.stringValue(query.search),
  };
}

export const HistoryFormRequest = {
  parseDeliveryHistoryQuery,
  parseAuditHistoryQuery,
};
