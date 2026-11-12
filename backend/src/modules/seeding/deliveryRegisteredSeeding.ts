import { DeliveryHistoryEventType, GoodsType, Prisma, SlotStatus, VehicleType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getVNDateKey, getVNDateRangeUtc } from '../../lib/dateVN';
import { helperFunctions } from '../../helperFunction';
import type { AuthUser } from '../../middleware/auth';
import { emitQueueUpdated } from '../../socket';
import { recordAuditLog, systemActor, userActor } from '../../services/auditLog';
import { reserveRegistrationCode } from '../../services/registrationSequence';
import { recordDeliveryEvent } from '../history/historyService';
import * as deliveryRepository from '../deliveries/deliveryRepository';
import {
  CONSTRUCTION_CODE_CHARS,
  CONSTRUCTION_CODE_LETTERS,
  DEMO_VENDORS,
  FAMILY_NAMES,
  GIVEN_NAMES,
  MIDDLE_NAMES,
  MOTORBIKE_PLATE_SERIES,
  PHONE_PREFIXES,
  PLATE_PROVINCES,
  TRUCK_PLATE_SERIES,
} from './seedingData';

/**
 * Simulation seeding: creates REGISTERED deliveries for today (VN time) in every
 * target BusinessLocation, spread evenly across active UnitConfigs, the goods
 * types each unit accepts and both vehicle types. Everything after registration
 * (check-in, dispatch, receiving, schedulers) is left to the running system.
 *
 * Mirrors the rules of `registerDelivery()`: unique plate per location/day under
 * the same advisory lock, atomic registration code, auto-warehouse resolution by
 * vendor code, REGISTERED history event and `queue_updated` emit. The manual
 * daily-capacity estimate is intentionally skipped (as for verified PO/Thi Công
 * registrations) so a bulk run is never rejected with SlotFull.
 */

export const REGISTERED_DELIVERY_SEED_COUNT = 100;
export const SEEDED_DELIVERY_NOTE = 'Dữ liệu mô phỏng tự sinh';

const SEED_ACTOR_LABEL = 'seeding:registered-deliveries';
const BASE_GOODS: GoodsType[] = [GoodsType.FRESH_FOOD, GoodsType.GENERAL_GOODS, GoodsType.THI_CONG];
const VEHICLE_TYPES: VehicleType[] = [VehicleType.TRUCK, VehicleType.MOTORBIKE];
/** Share of new order codes that are split across 2–3 vehicles. */
const SHARED_ORDER_RATE = 0.25;
/** Every Nth row of a unit with auto-warehouse vendors uses one of them. */
const AUTO_WAREHOUSE_VENDOR_EVERY = 5;
const MAX_PLATE_ATTEMPTS = 50;

type Vendor = { vendorCode: string; vendorName: string };

type Combo = {
  baseType: GoodsType;
  unitGoodsTypeId: string | null;
  vehicleType: VehicleType;
};

type SeedUnit = {
  id: string;
  unit: string;
  displayName: string;
  combos: Combo[];
  autoWarehouseVendors: Vendor[];
  autoWarehouseCodes: Set<string>;
};

type OpenOrderGroup = { orderCode: string; vendor: Vendor; remaining: number; uses: number };

type GoodsCounter = Record<GoodsType, number>;
type VehicleCounter = Record<VehicleType, number>;

export type UnitSeedSummary = {
  unitConfigId: string;
  unit: string;
  displayName: string;
  created: number;
  byVehicle: VehicleCounter;
  byGoods: GoodsCounter;
  sharedOrderCodes: number;
};

export type LocationSeedSummary = {
  businessLocationId: string;
  code: string;
  locationName: string;
  status: 'SEEDED' | 'SKIPPED' | 'FAILED';
  created: number;
  message?: string;
  units: UnitSeedSummary[];
};

export type RegisteredDeliverySeedResult = {
  type: 'registered-deliveries';
  deliveryDate: string;
  perLocation: number;
  totalCreated: number;
  locations: LocationSeedSummary[];
};

type TargetLocation = { id: string; code: string; locationName: string };

function randomInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

function pick<T>(items: readonly T[]): T {
  return items[randomInt(items.length)];
}

function randomDigits(length: number): string {
  let value = '';
  for (let i = 0; i < length; i++) value += String(randomInt(10));
  return value;
}

function emptyGoodsCounter(): GoodsCounter {
  return { FRESH_FOOD: 0, GENERAL_GOODS: 0, THI_CONG: 0, AUTO_WAREHOUSE: 0 };
}

function emptyVehicleCounter(): VehicleCounter {
  return { TRUCK: 0, MOTORBIKE: 0 };
}

function isSundayDateKey(dateKey: string): boolean {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

/** Splits `total` across `buckets` as evenly as possible; remainder goes to the first buckets. */
function distribute(total: number, buckets: number): number[] {
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

function generateDriverName(): string {
  return `${pick(FAMILY_NAMES)} ${pick(MIDDLE_NAMES)} ${pick(GIVEN_NAMES)}`;
}

function generateDriverPhone(): string {
  return `${pick(PHONE_PREFIXES)}${randomDigits(7)}`;
}

function generatePlate(vehicleType: VehicleType): string {
  const province = pick(PLATE_PROVINCES);
  const tail = `${randomDigits(3)}.${randomDigits(2)}`;
  if (vehicleType === VehicleType.TRUCK) return `${province}${pick(TRUCK_PLATE_SERIES)}-${tail}`;
  return `${province}${pick(MOTORBIKE_PLATE_SERIES)}${1 + randomInt(9)}-${tail}`;
}

/** PO: 10 digits starting with 450 (same format `/register` validates). */
function generatePoCode(): string {
  return `450${randomDigits(7)}`;
}

/** Thi Công: exactly 5 alphanumerics with at least one letter. */
function generateConstructionCode(): string {
  const chars = Array.from({ length: 5 }, () => pick(CONSTRUCTION_CODE_CHARS.split('')));
  chars[randomInt(5)] = pick(CONSTRUCTION_CODE_LETTERS.split(''));
  return chars.join('');
}

function comboGroupKey(combo: Combo): string {
  return `${combo.baseType}:${combo.unitGoodsTypeId ?? ''}`;
}

async function resolveTargetLocations(user: AuthUser): Promise<TargetLocation[]> {
  const select = { id: true, code: true, locationName: true } as const;
  if (user.role === 'SUPERADMIN') {
    return prisma.businessLocation.findMany({ where: { isActive: true }, select, orderBy: { code: 'asc' } });
  }
  if (!user.businessLocationId) return [];
  const location = await prisma.businessLocation.findFirst({ where: { id: user.businessLocationId, isActive: true }, select });
  return location ? [location] : [];
}

/**
 * Active units of a location that can actually accept a registration today:
 * at least one operational slot (same rule as vehicle availability) and at
 * least one accepted goods type.
 */
async function loadSeedUnits(businessLocationId: string, dateKey: string): Promise<SeedUnit[]> {
  const sunday = isSundayDateKey(dateKey);
  const unitConfigs = await prisma.unitConfig.findMany({
    where: { businessLocationId, isActive: true },
    orderBy: { unit: 'asc' },
    select: {
      id: true,
      unit: true,
      displayName: true,
      shortName: true,
      freshFoodEnabled: true,
      generalGoodsEnabled: true,
      thiCongEnabled: true,
      sundayFreshFoodOnly: true,
      unitGoodsTypes: {
        where: { enabled: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, baseType: true },
      },
      autoWarehouseVendors: {
        where: { active: true },
        select: { unit: true, vendorCode: true, vendorName: true },
      },
      zones: {
        select: {
          slots: {
            where: { isActive: true, status: { notIn: [SlotStatus.MAINTENANCE, SlotStatus.RESERVED] } },
            select: { assignedUnit: true },
          },
        },
      },
    },
  });

  return unitConfigs.flatMap((unitConfig) => {
    const hasOperationalSlot = unitConfig.zones.some((zone) => zone.slots.some((slot) => slot.assignedUnit === unitConfig.unit));
    if (!hasOperationalSlot) return [];

    const goodsOptions = BASE_GOODS
      .filter((baseType) => helperFunctions.unitAcceptsGoods(unitConfig, baseType))
      .filter((baseType) => !(sunday && unitConfig.sundayFreshFoodOnly) || baseType === GoodsType.FRESH_FOOD)
      .flatMap((baseType) => {
        const custom = unitConfig.unitGoodsTypes.filter((goodsType) => goodsType.baseType === baseType);
        return custom.length > 0
          ? custom.map((goodsType) => ({ baseType, unitGoodsTypeId: goodsType.id as string | null }))
          : [{ baseType, unitGoodsTypeId: null as string | null }];
      });
    if (goodsOptions.length === 0) return [];

    // Goods-major / vehicle-minor ordering makes consecutive rows alternate
    // truck and motorbike while cycling through every goods type.
    const combos = goodsOptions.flatMap((goods) => VEHICLE_TYPES.map((vehicleType) => ({ ...goods, vehicleType })));
    // Same match rule as findAutoWarehouseVendor(): active, same unit code, same UnitConfig.
    const autoWarehouseVendors = unitConfig.autoWarehouseVendors
      .filter((vendor) => vendor.unit === unitConfig.unit)
      .map(({ vendorCode, vendorName }) => ({ vendorCode, vendorName }));

    return [{
      id: unitConfig.id,
      unit: unitConfig.unit,
      displayName: unitConfig.displayName || unitConfig.shortName || unitConfig.unit,
      combos,
      autoWarehouseVendors,
      autoWarehouseCodes: new Set(autoWarehouseVendors.map((vendor) => vendor.vendorCode)),
    }];
  });
}

async function loadUsedPlates(tx: Prisma.TransactionClient, businessLocationId: string, dateKey: string): Promise<Set<string>> {
  const { start, end } = getVNDateRangeUtc(dateKey);
  const today = { gte: start, lt: end };
  const active = await tx.deliveryRegistration.findMany({
    where: { unitConfig: { businessLocationId }, OR: [{ requestedTime: today }, { createdAt: today }] },
    select: { vehiclePlate: true },
  });
  const archived = await tx.deliveryHistory.findMany({
    where: { businessLocationId, OR: [{ requestedTime: today }, { registeredAt: today }] },
    select: { vehiclePlate: true },
  });
  return new Set([...active, ...archived].map((row) => row.vehiclePlate));
}

async function reserveUniquePlate(
  tx: Prisma.TransactionClient,
  args: { businessLocationId: string; dateKey: string; requestedTime: Date; vehicleType: VehicleType; usedPlates: Set<string> },
): Promise<string> {
  for (let attempt = 0; attempt < MAX_PLATE_ATTEMPTS; attempt++) {
    const vehiclePlate = deliveryRepository.normalizeVehiclePlate(generatePlate(args.vehicleType));
    if (args.usedPlates.has(vehiclePlate)) continue;
    args.usedPlates.add(vehiclePlate);

    // Same lock key as registerDelivery() so a real registration of the same
    // plate cannot slip in between the check and the insert.
    const lockKey = ['registration-duplicate', args.businessLocationId, args.dateKey, vehiclePlate].join(':');
    await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(${deliveryRepository.advisoryLockId(lockKey)})`);
    const duplicates = await deliveryRepository.findDuplicateRegistration({
      vehiclePlate,
      businessLocationId: args.businessLocationId,
      requestedTime: args.requestedTime,
      client: tx,
    });
    if (duplicates.length === 0) return vehiclePlate;
  }
  throw new Error('Không sinh được biển số xe không trùng sau nhiều lần thử.');
}

async function tryLockLocation(tx: Prisma.TransactionClient, businessLocationId: string): Promise<boolean> {
  const lockId = deliveryRepository.advisoryLockId(`seeding:registered-deliveries:${businessLocationId}`);
  const rows = await tx.$queryRaw<Array<{ locked: boolean }>>(Prisma.sql`SELECT pg_try_advisory_xact_lock(${lockId}) AS locked`);
  return rows[0]?.locked === true;
}

class LocationBusyError extends Error {}

async function seedLocation(
  location: TargetLocation,
  user: AuthUser,
  context: { dateKey: string; requestedTime: Date; vendorCursor: { value: number } },
): Promise<LocationSeedSummary> {
  const base: LocationSeedSummary = {
    businessLocationId: location.id,
    code: location.code,
    locationName: location.locationName,
    status: 'SKIPPED',
    created: 0,
    units: [],
  };

  const units = await loadSeedUnits(location.id, context.dateKey);
  if (units.length === 0) {
    return { ...base, message: 'Không có đơn vị active nào có slot hoạt động và loại hàng đang mở.' };
  }

  const allocation = distribute(REGISTERED_DELIVERY_SEED_COUNT, units.length);

  try {
    const unitSummaries = await prisma.$transaction(async (tx) => {
      if (!(await tryLockLocation(tx, location.id))) throw new LocationBusyError();

      const usedPlates = await loadUsedPlates(tx, location.id, context.dateKey);
      const usedOrderCodes = new Set<string>();
      const summaries: UnitSeedSummary[] = [];

      for (const [unitIndex, unit] of units.entries()) {
        const summary: UnitSeedSummary = {
          unitConfigId: unit.id,
          unit: unit.unit,
          displayName: unit.displayName,
          created: 0,
          byVehicle: emptyVehicleCounter(),
          byGoods: emptyGoodsCounter(),
          sharedOrderCodes: 0,
        };
        const openGroups = new Map<string, OpenOrderGroup>();

        for (let row = 0; row < allocation[unitIndex]; row++) {
          const combo = unit.combos[row % unit.combos.length];
          const groupKey = comboGroupKey(combo);

          // Reuse an order code split across several vehicles, or open a new one.
          let group = openGroups.get(groupKey);
          if (group && group.remaining > 0) {
            group.remaining -= 1;
            group.uses += 1;
            // Count an order code as shared only once a second vehicle really uses it.
            if (group.uses === 2) summary.sharedOrderCodes += 1;
          } else {
            let orderCode: string;
            do {
              orderCode = combo.baseType === GoodsType.THI_CONG ? generateConstructionCode() : generatePoCode();
            } while (usedOrderCodes.has(orderCode));
            usedOrderCodes.add(orderCode);

            const useAutoWarehouseVendor = combo.baseType !== GoodsType.THI_CONG
              && unit.autoWarehouseVendors.length > 0
              && row % AUTO_WAREHOUSE_VENDOR_EVERY === AUTO_WAREHOUSE_VENDOR_EVERY - 1;
            const vendor = useAutoWarehouseVendor
              ? pick(unit.autoWarehouseVendors)
              : DEMO_VENDORS[context.vendorCursor.value++ % DEMO_VENDORS.length];
            const shared = Math.random() < SHARED_ORDER_RATE;
            group = { orderCode, vendor, remaining: shared ? 1 + randomInt(2) : 0, uses: 1 };
            openGroups.set(groupKey, group);
          }

          const vehiclePlate = await reserveUniquePlate(tx, {
            businessLocationId: location.id,
            dateKey: context.dateKey,
            requestedTime: context.requestedTime,
            vehicleType: combo.vehicleType,
            usedPlates,
          });

          // Same resolution as registerDelivery(): vendor code in the unit's
          // active auto-warehouse list turns the delivery into AUTO_WAREHOUSE.
          const vendorCode = group.vendor.vendorCode.toUpperCase().trim();
          const goodsType = unit.autoWarehouseCodes.has(vendorCode) ? GoodsType.AUTO_WAREHOUSE : combo.baseType;

          const registrationCode = await reserveRegistrationCode(tx, {
            unitConfigId: unit.id,
            businessLocationCode: location.code,
            receivingUnit: unit.unit,
          });
          const created = await tx.deliveryRegistration.create({
            data: {
              registrationCode,
              vendorName: group.vendor.vendorName,
              vendorCode,
              driverName: generateDriverName(),
              driverPhone: generateDriverPhone(),
              vehiclePlate,
              vehicleType: combo.vehicleType,
              receivingUnit: unit.unit,
              unitConfigId: unit.id,
              goodsType,
              originalGoodsType: combo.baseType,
              unitGoodsTypeId: combo.unitGoodsTypeId,
              poNumber: group.orderCode,
              requestedTime: context.requestedTime,
              autoWarehouse: goodsType === GoodsType.AUTO_WAREHOUSE,
              note: SEEDED_DELIVERY_NOTE,
            },
          });

          await recordDeliveryEvent(created, {
            ...systemActor(SEED_ACTOR_LABEL),
            eventType: DeliveryHistoryEventType.REGISTERED,
            toStatus: created.status,
            occurredAt: created.createdAt,
            message: 'Đăng ký giao hàng (dữ liệu mô phỏng)',
            metadata: { seeding: 'registered-deliveries', seededByUserId: user.id },
          }, tx);

          summary.created += 1;
          summary.byVehicle[combo.vehicleType] += 1;
          summary.byGoods[goodsType] += 1;
        }

        summaries.push(summary);
      }

      await recordAuditLog({
        ...userActor(user),
        action: 'seeding.registered_deliveries',
        targetType: 'BusinessLocation',
        targetId: location.id,
        businessLocationId: location.id,
        after: {
          deliveryDate: context.dateKey,
          created: summaries.reduce((sum, unit) => sum + unit.created, 0),
          units: summaries.map((unit) => ({ unitConfigId: unit.unitConfigId, unit: unit.unit, created: unit.created })),
        },
      }, tx);

      return summaries;
    }, { maxWait: 10_000, timeout: 120_000 });

    // New registrations change dashboard totals and upcoming lists even before check-in.
    for (const unit of unitSummaries) {
      if (unit.created === 0) continue;
      const scope = { businessLocationId: location.id, unitConfigId: unit.unitConfigId };
      deliveryRepository.getFullQueue(scope)
        .then((queue) => emitQueueUpdated(queue, scope))
        .catch((error) => console.error('Failed to emit seeding queue update:', error));
    }

    return {
      ...base,
      status: 'SEEDED',
      created: unitSummaries.reduce((sum, unit) => sum + unit.created, 0),
      units: unitSummaries,
    };
  } catch (error) {
    if (error instanceof LocationBusyError) {
      return { ...base, message: 'Đang có tiến trình seed khác chạy cho khu vực này. Vui lòng thử lại sau.' };
    }
    console.error(`Seeding registered deliveries failed for location ${location.code}:`, error);
    return { ...base, status: 'FAILED', message: helperFunctions.errorMessage(error) };
  }
}

export async function seedRegisteredDeliveries(user: AuthUser): Promise<RegisteredDeliverySeedResult> {
  const dateKey = getVNDateKey();
  // Same requestedTime the manual flow stores: 00:00 Vietnam time of today.
  const requestedTime = deliveryRepository.parseDeliveryDateStartVN(dateKey)!;
  const locations = await resolveTargetLocations(user);

  const context = { dateKey, requestedTime, vendorCursor: { value: randomInt(DEMO_VENDORS.length) } };
  const summaries: LocationSeedSummary[] = [];
  // Sequential on purpose: one location transaction at a time keeps DB load and
  // registration-sequence row locks bounded.
  for (const location of locations) {
    summaries.push(await seedLocation(location, user, context));
  }

  return {
    type: 'registered-deliveries',
    deliveryDate: dateKey,
    perLocation: REGISTERED_DELIVERY_SEED_COUNT,
    totalCreated: summaries.reduce((sum, location) => sum + location.created, 0),
    locations: summaries,
  };
}
