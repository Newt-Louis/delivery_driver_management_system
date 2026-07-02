import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import {
  DeliveryStatus,
  GoodsType,
  Prisma,
  ReceivingUnit,
  SlotStatus,
  VehicleType,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { checkInDelivery } from '../services/checkInDelivery';
import { manualCallDelivery, manualCallResultIsSuccess } from '../services/manualCallDelivery';
import { completeDelivery } from '../services/deliveryLifecycle';
import { triggerAutoAssign } from '../services/autoAssign';
import { getVNDateKey } from '../lib/dateVN';
import { getIO, initSocket } from '../socket';
import deliveryRoutes from '../routes/deliveries';

const server = createServer();
initSocket(server);

after(async () => {
  getIO().close();
  await prisma.$disconnect();
});

let counter = 0;

const ACTIVE_REGISTRATION_STATUSES: DeliveryStatus[] = [
  DeliveryStatus.REGISTERED,
  DeliveryStatus.WAITING,
  DeliveryStatus.CALLED,
  DeliveryStatus.RECEIVING,
  DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
];
type TestScope = {
  prefix: string;
  businessLocationId: string;
  unitConfigId: string;
  zoneId: string;
};

type TicketSequenceSnapshot = {
  ticketDate: string;
  receivingUnit: ReceivingUnit;
  vehicleType: VehicleType;
  nextNumber: number | null;
};

function nextPrefix(label: string): string {
  counter++;
  return `CT${Date.now().toString(36).toUpperCase()}${counter}${label}`.replace(/[^A-Z0-9]/g, '');
}

async function cleanupPrefix(prefix: string): Promise<void> {
  const [deliveries, slots, zones, unitConfigs, locations, users] = await Promise.all([
    prisma.deliveryRegistration.findMany({
      where: {
        OR: [
          { registrationCode: { startsWith: prefix } },
          { vehiclePlate: { startsWith: prefix } },
          { note: prefix },
        ],
      },
      select: { id: true },
    }),
    prisma.slot.findMany({
      where: { code: { startsWith: prefix } },
      select: { id: true },
    }),
    prisma.zone.findMany({
      where: { code: { startsWith: prefix } },
      select: { id: true },
    }),
    prisma.unitConfig.findMany({
      where: { businessLocation: { code: { startsWith: prefix } } },
      select: { id: true },
    }),
    prisma.businessLocation.findMany({
      where: { code: { startsWith: prefix } },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { email: { startsWith: `${prefix.toLowerCase()}-` } },
      select: { id: true },
    }),
  ]);

  const deliveryIds = deliveries.map((row) => row.id);
  const slotIds = slots.map((row) => row.id);
  const zoneIds = zones.map((row) => row.id);
  const unitConfigIds = unitConfigs.map((row) => row.id);
  const locationIds = locations.map((row) => row.id);
  const userIds = users.map((row) => row.id);
  const auditOr: Prisma.AuditLogWhereInput[] = [
    ...(deliveryIds.length ? [{ targetId: { in: deliveryIds } }] : []),
    ...(slotIds.length ? [{ targetId: { in: slotIds } }] : []),
    ...(userIds.length ? [{ actorId: { in: userIds } }] : []),
    ...(locationIds.length ? [{ businessLocationId: { in: locationIds } }] : []),
    ...(unitConfigIds.length ? [{ unitConfigId: { in: unitConfigIds } }] : []),
  ];

  await prisma.$transaction([
    ...(auditOr.length ? [prisma.auditLog.deleteMany({ where: { OR: auditOr } })] : []),
    ...(deliveryIds.length ? [prisma.callLog.deleteMany({ where: { deliveryRegistrationId: { in: deliveryIds } } })] : []),
    ...(slotIds.length ? [prisma.callLog.deleteMany({ where: { slotId: { in: slotIds } } })] : []),
    ...(deliveryIds.length ? [prisma.deliveryRegistration.deleteMany({ where: { id: { in: deliveryIds } } })] : []),
    ...(slotIds.length ? [prisma.slot.deleteMany({ where: { id: { in: slotIds } } })] : []),
    ...(zoneIds.length ? [prisma.zone.deleteMany({ where: { id: { in: zoneIds } } })] : []),
    ...(unitConfigIds.length ? [prisma.unitConfig.deleteMany({ where: { id: { in: unitConfigIds } } })] : []),
    ...(userIds.length ? [prisma.user.deleteMany({ where: { id: { in: userIds } } })] : []),
    ...(locationIds.length ? [prisma.businessLocation.deleteMany({ where: { id: { in: locationIds } } })] : []),
  ]);
}

async function withScope<T>(
  label: string,
  unit: ReceivingUnit,
  fn: (scope: TestScope) => Promise<T>,
): Promise<T> {
  const prefix = nextPrefix(label);
  await cleanupPrefix(prefix);
  const location = await prisma.businessLocation.create({
    data: {
      code: prefix,
      locationName: `Concurrency ${prefix}`,
    },
  });
  const unitConfig = await prisma.unitConfig.create({
    data: {
      businessLocationId: location.id,
      unit,
      displayName: `Concurrency ${unit}`,
      shortName: unit,
    },
  });
  const zone = await prisma.zone.create({
    data: {
      code: `${prefix}Z`,
      name: `Zone ${prefix}`,
      unitConfigId: unitConfig.id,
    },
  });

  try {
    return await fn({
      prefix,
      businessLocationId: location.id,
      unitConfigId: unitConfig.id,
      zoneId: zone.id,
    });
  } finally {
    await cleanupPrefix(prefix);
  }
}

async function createSlot(
  scope: TestScope,
  options: {
    suffix: string;
    unit?: ReceivingUnit;
    vehicleType?: VehicleType;
    maxCapacity?: number;
    acceptedGoods?: GoodsType[];
    autoWarehouseOnly?: boolean;
  },
) {
  return prisma.slot.create({
    data: {
      code: `${scope.prefix}${options.suffix}`,
      name: `Slot ${options.suffix}`,
      zoneId: scope.zoneId,
      assignedUnit: options.unit ?? ReceivingUnit.EMART,
      vehicleType: options.vehicleType ?? VehicleType.TRUCK,
      maxCapacity: options.maxCapacity ?? 1,
      acceptedGoods: options.acceptedGoods ?? [],
      autoWarehouseOnly: options.autoWarehouseOnly ?? false,
      status: SlotStatus.AVAILABLE,
      isActive: true,
      autoAssign: true,
    },
  });
}

async function createDelivery(
  scope: TestScope,
  index: number,
  options: {
    status?: DeliveryStatus;
    unit?: ReceivingUnit;
    vehicleType?: VehicleType;
    goodsType?: GoodsType;
    assignedSlotId?: string | null;
    checkinTime?: Date | null;
    calledTime?: Date | null;
  } = {},
) {
  return prisma.deliveryRegistration.create({
    data: {
      registrationCode: `${scope.prefix}D${String(index).padStart(3, '0')}`,
      vendorName: `Vendor ${scope.prefix}`,
      driverName: `Driver ${index}`,
      driverPhone: `090${String(index).padStart(7, '0')}`,
      vehiclePlate: `${scope.prefix}${String(index).padStart(3, '0')}`,
      receivingUnit: options.unit ?? ReceivingUnit.EMART,
      vehicleType: options.vehicleType ?? VehicleType.TRUCK,
      goodsType: options.goodsType ?? GoodsType.GENERAL_GOODS,
      requestedTime: new Date(),
      checkinTime: options.checkinTime ?? null,
      calledTime: options.calledTime ?? null,
      status: options.status ?? DeliveryStatus.REGISTERED,
      assignedSlotId: options.assignedSlotId ?? null,
      note: scope.prefix,
    },
  });
}

async function createAdminUser(scope: TestScope) {
  return prisma.user.create({
    data: {
      name: `Admin ${scope.prefix}`,
      email: `${scope.prefix.toLowerCase()}-admin@test.local`,
      passwordHash: 'test',
      role: 'ADMIN',
      unit: ReceivingUnit.EMART,
      businessLocationId: scope.businessLocationId,
    },
  });
}

async function captureTicketSequence(
  receivingUnit: ReceivingUnit,
  vehicleType: VehicleType,
): Promise<TicketSequenceSnapshot> {
  const ticketDate = getVNDateKey(new Date());
  const existing = await prisma.ticketSequence.findUnique({
    where: {
      ticketDate_receivingUnit_vehicleType: {
        ticketDate,
        receivingUnit,
        vehicleType,
      },
    },
    select: { nextNumber: true },
  });
  return {
    ticketDate,
    receivingUnit,
    vehicleType,
    nextNumber: existing?.nextNumber ?? null,
  };
}

async function restoreTicketSequence(snapshot: TicketSequenceSnapshot): Promise<void> {
  const where = {
    ticketDate_receivingUnit_vehicleType: {
      ticketDate: snapshot.ticketDate,
      receivingUnit: snapshot.receivingUnit,
      vehicleType: snapshot.vehicleType,
    },
  };
  if (snapshot.nextNumber === null) {
    await prisma.ticketSequence.deleteMany({
      where: {
        ticketDate: snapshot.ticketDate,
        receivingUnit: snapshot.receivingUnit,
        vehicleType: snapshot.vehicleType,
      },
    });
    return;
  }
  await prisma.ticketSequence.upsert({
    where,
    create: {
      ticketDate: snapshot.ticketDate,
      receivingUnit: snapshot.receivingUnit,
      vehicleType: snapshot.vehicleType,
      nextNumber: snapshot.nextNumber,
    },
    update: { nextNumber: snapshot.nextNumber },
  });
}

function localDateTimeAfterDays(days: number, hour: number, minute: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
}
async function withRegisterServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const app = express();
  app.use(express.json());
  app.use('/api/deliveries', deliveryRoutes);
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });

  const httpServer = createServer(app);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address() as AddressInfo;
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
async function skipAutoAssignIfForeignWaiting(
  t: { skip: (message?: string) => void },
  prefix: string,
  unit: ReceivingUnit,
  vehicleType: VehicleType,
): Promise<boolean> {
  const foreignWaiting = await prisma.deliveryRegistration.count({
    where: {
      receivingUnit: unit,
      vehicleType,
      status: DeliveryStatus.WAITING,
      registrationCode: { not: { startsWith: prefix } },
    },
  });
  if (foreignWaiting > 0) {
    t.skip(
      `Skipped auto-assign isolation check because ${foreignWaiting} non-test ${unit}/${vehicleType} WAITING deliveries exist.`,
    );
    return true;
  }
  return false;
}

test('50 concurrent identical registrations create one active delivery', async () => {
  await withRegisterServer(async (baseUrl) => {
    const prefix = nextPrefix('REGDUP50');
    await cleanupPrefix(prefix);
    const vehiclePlate = `${prefix}PLATE`;
    const payload = {
      vendorName: 'Concurrent Vendor',
      driverName: 'Concurrent Driver',
      driverPhone: '0900000000',
      vehiclePlate,
      vehicleType: 'TRUCK',
      receivingUnit: 'EMART',
      goodsType: 'GENERAL_GOODS',
      note: prefix,
    };

    try {
      const responses = await Promise.all(
        Array.from({ length: 50 }, () => fetch(`${baseUrl}/api/deliveries/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })),
      );

      const statuses = responses.map((res) => res.status);
      assert.equal(statuses.filter((status) => status === 201).length, 1);
      assert.equal(statuses.filter((status) => status === 409).length, 49);

      const deliveries = await prisma.deliveryRegistration.findMany({
        where: {
          vehiclePlate,
          status: { in: ACTIVE_REGISTRATION_STATUSES },
        },
      });
      assert.equal(deliveries.length, 1);
    } finally {
      await cleanupPrefix(prefix);
    }
  });
});
test('50 concurrent registrations for one time slot respect configured capacity', async () => {
  await withRegisterServer(async (baseUrl) => {
    const prefix = nextPrefix('REGSLOT50');
    await cleanupPrefix(prefix);
    const location = await prisma.businessLocation.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    assert.ok(location);

    const config = await prisma.unitConfig.findUnique({
      where: {
        businessLocationId_unit: {
          businessLocationId: location.id,
          unit: ReceivingUnit.EMART,
        },
      },
    });
    assert.ok(config);

    const originalTruckMaxPerSlot = config.truckMaxPerSlot;
    const requestedTime = localDateTimeAfterDays(30, 3, 17);

    try {
      await prisma.unitConfig.update({
        where: { id: config.id },
        data: { truckMaxPerSlot: 1 },
      });

      const responses = await Promise.all(
        Array.from({ length: 50 }, (_, i) => fetch(`${baseUrl}/api/deliveries/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorName: 'Concurrent Slot Vendor',
            driverName: `Driver ${i}`,
            driverPhone: `091${String(i).padStart(7, '0')}`,
            vehiclePlate: `${prefix}${String(i).padStart(3, '0')}`,
            vehicleType: 'TRUCK',
            receivingUnit: 'EMART',
            goodsType: 'GENERAL_GOODS',
            requestedTime,
            note: prefix,
          }),
        })),
      );

      const statuses = responses.map((res) => res.status);
      assert.equal(statuses.filter((status) => status === 201).length, 1);
      assert.equal(statuses.filter((status) => status === 409).length, 49);

      const deliveries = await prisma.deliveryRegistration.findMany({
        where: {
          note: prefix,
          status: DeliveryStatus.REGISTERED,
        },
      });
      assert.equal(deliveries.length, 1);
    } finally {
      await prisma.unitConfig.update({
        where: { id: config.id },
        data: { truckMaxPerSlot: originalTruckMaxPerSlot },
      });
      await cleanupPrefix(prefix);
    }
  });
});
test('20 concurrent check-ins receive unique ticket numbers', async () => {
  const snapshot = await captureTicketSequence(ReceivingUnit.EMART, VehicleType.TRUCK);
  try {
    await withScope('CHECKIN20', ReceivingUnit.EMART, async (scope) => {
      const deliveries = await Promise.all(
        Array.from({ length: 20 }, (_, i) => createDelivery(scope, i + 1)),
      );

      const results = await Promise.all(
        deliveries.map((delivery) => checkInDelivery({
          deliveryId: delivery.id,
          resultArgs: {},
        })),
      );

      assert.equal(results.filter((result) => result.checkedIn).length, 20);
      const ticketNumbers = results.map((result) => result.delivery?.ticketNumber);
      assert.equal(ticketNumbers.filter((ticketNumber) => ticketNumber !== null).length, 20);
      assert.equal(new Set(ticketNumbers).size, 20);
    });
  } finally {
    await restoreTicketSequence(snapshot);
  }
});

test('5 concurrent scans of the same QR are idempotent', async () => {
  const snapshot = await captureTicketSequence(ReceivingUnit.EMART, VehicleType.TRUCK);
  try {
    await withScope('SAMEQR', ReceivingUnit.EMART, async (scope) => {
      const delivery = await createDelivery(scope, 1);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => checkInDelivery({
          deliveryId: delivery.id,
          resultArgs: {},
        })),
      );

      assert.equal(results.filter((result) => result.checkedIn).length, 1);
      const final = await prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: delivery.id } });
      assert.equal(final.status, DeliveryStatus.WAITING);
      assert.notEqual(final.ticketNumber, null);
      const nonNullTickets = results.map((result) => result.delivery?.ticketNumber).filter(Boolean);
      assert.equal(new Set(nonNullTickets).size, 1);
    });
  } finally {
    await restoreTicketSequence(snapshot);
  }
});

test('5 concurrent manual calls for one delivery create only one call log', async () => {
  await withScope('MANUALONE', ReceivingUnit.EMART, async (scope) => {
    const [slot, user] = await Promise.all([
      createSlot(scope, { suffix: 'S1' }),
      createAdminUser(scope),
    ]);
    const delivery = await createDelivery(scope, 1, {
      status: DeliveryStatus.WAITING,
      checkinTime: new Date(),
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => manualCallDelivery({
        deliveryId: delivery.id,
        slotId: slot.id,
        calledByUserId: user.id,
      })),
    );

    assert.equal(results.filter((result) => manualCallResultIsSuccess(result)).length, 5);
    assert.equal(
      results.filter((result) => manualCallResultIsSuccess(result) && result.callLogCreated).length,
      1,
    );
    const callLogs = await prisma.callLog.count({ where: { deliveryRegistrationId: delivery.id } });
    const final = await prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: delivery.id } });
    assert.equal(callLogs, 1);
    assert.equal(final.status, DeliveryStatus.CALLED);
    assert.equal(final.assignedSlotId, slot.id);
  });
});

test('10 concurrent motorbike manual calls do not exceed slot maxCapacity=3', async () => {
  await withScope('CAPACITY3', ReceivingUnit.EMART, async (scope) => {
    const [slot, user] = await Promise.all([
      createSlot(scope, { suffix: 'M1', vehicleType: VehicleType.MOTORBIKE, maxCapacity: 3 }),
      createAdminUser(scope),
    ]);
    const deliveries = await Promise.all(
      Array.from({ length: 10 }, (_, i) => createDelivery(scope, i + 1, {
        status: DeliveryStatus.WAITING,
        vehicleType: VehicleType.MOTORBIKE,
        checkinTime: new Date(Date.now() + i),
      })),
    );

    const results = await Promise.all(
      deliveries.map((delivery) => manualCallDelivery({
        deliveryId: delivery.id,
        slotId: slot.id,
        calledByUserId: user.id,
      })),
    );

    const calledCount = await prisma.deliveryRegistration.count({
      where: {
        assignedSlotId: slot.id,
        status: {
          in: [
            DeliveryStatus.CALLED,
            DeliveryStatus.RECEIVING,
            DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
          ],
        },
      },
    });
    const callLogs = await prisma.callLog.count({ where: { slotId: slot.id } });
    assert.equal(calledCount, 3);
    assert.equal(callLogs, 3);
    assert.equal(results.filter((result) => manualCallResultIsSuccess(result) && result.callLogCreated).length, 3);
  });
});

test('concurrent complete requests complete once and reconcile slot to AVAILABLE', async () => {
  await withScope('COMPLETE1', ReceivingUnit.EMART, async (scope) => {
    const slot = await createSlot(scope, { suffix: 'S1' });
    const delivery = await createDelivery(scope, 1, {
      status: DeliveryStatus.CALLED,
      assignedSlotId: slot.id,
      calledTime: new Date(),
    });
    await prisma.slot.update({
      where: { id: slot.id },
      data: { status: SlotStatus.OCCUPIED, currentDeliveryId: delivery.id },
    });

    const results = await Promise.all(
      Array.from({ length: 5 }, () => completeDelivery(delivery.id)),
    );

    assert.equal(results.filter((result) => result.changed).length, 1);
    const [finalDelivery, finalSlot] = await Promise.all([
      prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: delivery.id } }),
      prisma.slot.findUniqueOrThrow({ where: { id: slot.id } }),
    ]);
    assert.equal(finalDelivery.status, DeliveryStatus.COMPLETED);
    assert.equal(finalSlot.status, SlotStatus.AVAILABLE);
    assert.equal(finalSlot.currentDeliveryId, null);
  });
});

test('3 concurrent complete requests trigger auto-assign for the next delivery only once', async (t) => {
  await withScope('COMPAUTO', ReceivingUnit.EMART, async (scope) => {
    if (await skipAutoAssignIfForeignWaiting(t, scope.prefix, ReceivingUnit.EMART, VehicleType.TRUCK)) return;
    const slot = await createSlot(scope, { suffix: 'S1' });
    const active = await createDelivery(scope, 1, {
      status: DeliveryStatus.CALLED,
      assignedSlotId: slot.id,
      calledTime: new Date(Date.now() - 60_000),
    });
    const next = await createDelivery(scope, 2, {
      status: DeliveryStatus.WAITING,
      checkinTime: new Date(),
    });
    await prisma.slot.update({
      where: { id: slot.id },
      data: { status: SlotStatus.OCCUPIED, currentDeliveryId: active.id },
    });

    const results = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const result = await completeDelivery(active.id);
        if (result.changed) {
          await triggerAutoAssign(ReceivingUnit.EMART, {
            businessLocationId: scope.businessLocationId,
            unitConfigId: scope.unitConfigId,
          });
        }
        return result;
      }),
    );

    const [finalActive, finalNext, finalSlot] = await Promise.all([
      prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: active.id } }),
      prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: next.id } }),
      prisma.slot.findUniqueOrThrow({ where: { id: slot.id } }),
    ]);
    const nextCallLogs = await prisma.callLog.count({ where: { deliveryRegistrationId: next.id } });
    assert.equal(results.filter((result) => result.changed).length, 1);
    assert.equal(finalActive.status, DeliveryStatus.COMPLETED);
    assert.equal(finalNext.status, DeliveryStatus.CALLED);
    assert.equal(finalNext.assignedSlotId, slot.id);
    assert.equal(nextCallLogs, 1);
    assert.equal(finalSlot.status, SlotStatus.OCCUPIED);
    assert.equal(finalSlot.currentDeliveryId, next.id);
  });
});

test('auto-assign does not put AUTO_WAREHOUSE delivery into a normal slot', async (t) => {
  await withScope('AWBLOCK', ReceivingUnit.EMART, async (scope) => {
    if (await skipAutoAssignIfForeignWaiting(t, scope.prefix, ReceivingUnit.EMART, VehicleType.TRUCK)) return;
    const slot = await createSlot(scope, { suffix: 'S1', acceptedGoods: [], autoWarehouseOnly: false });
    const delivery = await createDelivery(scope, 1, {
      status: DeliveryStatus.WAITING,
      goodsType: GoodsType.AUTO_WAREHOUSE,
      checkinTime: new Date(),
    });

    const called = await triggerAutoAssign(ReceivingUnit.EMART, {
      businessLocationId: scope.businessLocationId,
      unitConfigId: scope.unitConfigId,
    });

    const [finalDelivery, finalSlot] = await Promise.all([
      prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: delivery.id } }),
      prisma.slot.findUniqueOrThrow({ where: { id: slot.id } }),
    ]);
    assert.equal(called, 0);
    assert.equal(finalDelivery.status, DeliveryStatus.WAITING);
    assert.equal(finalSlot.status, SlotStatus.AVAILABLE);
    assert.equal(finalSlot.currentDeliveryId, null);
  });
});

test('auto-assign prioritizes FRESH_FOOD over older general goods for normal slot', async (t) => {
  await withScope('FRESHFIRST', ReceivingUnit.EMART, async (scope) => {
    if (await skipAutoAssignIfForeignWaiting(t, scope.prefix, ReceivingUnit.EMART, VehicleType.TRUCK)) return;
    const slot = await createSlot(scope, { suffix: 'S1', acceptedGoods: [] });
    const olderGeneral = await createDelivery(scope, 1, {
      status: DeliveryStatus.WAITING,
      goodsType: GoodsType.GENERAL_GOODS,
      checkinTime: new Date(Date.now() - 60_000),
    });
    const fresh = await createDelivery(scope, 2, {
      status: DeliveryStatus.WAITING,
      goodsType: GoodsType.FRESH_FOOD,
      checkinTime: new Date(),
    });

    const called = await triggerAutoAssign(ReceivingUnit.EMART, {
      businessLocationId: scope.businessLocationId,
      unitConfigId: scope.unitConfigId,
    });

    const [finalFresh, finalGeneral] = await Promise.all([
      prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: fresh.id } }),
      prisma.deliveryRegistration.findUniqueOrThrow({ where: { id: olderGeneral.id } }),
    ]);
    assert.equal(called, 1);
    assert.equal(finalFresh.status, DeliveryStatus.CALLED);
    assert.equal(finalFresh.assignedSlotId, slot.id);
    assert.equal(finalGeneral.status, DeliveryStatus.WAITING);
  });
});
