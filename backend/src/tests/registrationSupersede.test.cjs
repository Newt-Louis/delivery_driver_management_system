const test = require('node:test');
const assert = require('node:assert/strict');

function replace(path, overrides) {
  const file = require.resolve(path); const original = require(file);
  require.cache[file].exports = { ...original, ...overrides };
  return () => { require.cache[file].exports = original; };
}

function setup() {
  const rows = []; const histories = []; const deletedEvents = []; const deletedPush = [];
  const state = { sequence: 0, archived: false };
  const tx = {
    $executeRaw: async () => {}, $queryRaw: async () => [],
    deliveryHistory: { findFirst: async () => state.archived ? { id: 'old' } : null },
    deliveryHistoryEvent: { deleteMany: async ({ where }) => { deletedEvents.push(where.deliveryRegistrationId); return { count: 1 }; } },
    pushSubscription: { deleteMany: async ({ where }) => { deletedPush.push(where.deliveryCode); return { count: 0 }; } },
    deliveryRegistration: {
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
      delete: async ({ where }) => { const i = rows.findIndex((r) => r.id === where.id); return rows.splice(i, 1)[0]; },
      create: async ({ data }) => {
        const row = { ...data, id: `d${++state.sequence}`, status: 'REGISTERED', checkinTime: null, createdAt: new Date() };
        rows.push(row); return row;
      },
    },
    registrationHistory: {
      create: async ({ data }) => { const row = { ...data, id: `h${histories.length + 1}` }; histories.push(row); return row; },
      findUnique: async ({ where }) => histories.find((h) => h.registrationCode === where.registrationCode) ?? null,
      update: async ({ where, data }) => Object.assign(histories.find((h) => h.id === where.id), data),
    },
    auditLog: { create: async () => ({}) },
  };

  const restore = [];
  restore.push(replace('../modules/deliveries/deliveryRepository.ts', {
    prisma: { $transaction: async (fn) => fn(tx) },
    resolveRegistrationUnitConfig: async ({ unitConfigId, businessLocationId }) => ({ id: unitConfigId, businessLocationId, businessLocation: { code: 'L1' }, sundayFreshFoodOnly: false }),
    findDuplicateRegistration: async ({ vehiclePlate, businessLocationId }) => rows.filter((r) => r.vehiclePlate === vehiclePlate && r.unitLocation === businessLocationId && !['COMPLETED', 'CANCELLED'].includes(r.status)),
    getRegistrationDailyCapacity: async () => null, getFullQueue: async () => [],
  }));
  restore.push(replace('../services/registrationSequence.ts', { reserveRegistrationCode: async () => `CODE${state.sequence + 1}` }));
  restore.push(replace('../modules/history/historyService.ts', { recordDeliveryEvent: async () => {} }));
  restore.push(replace('../socket/index.ts', { emitQueueUpdated: () => {} }));
  const servicePath = require.resolve('../modules/deliveries/deliveryService.ts'); delete require.cache[servicePath];
  const { registerDelivery } = require(servicePath);
  // Gắn location cho row vừa tạo để mock findDuplicateRegistration lọc theo khu vực.
  const register = async (payload, context) => {
    const created = await registerDelivery(payload, context);
    const row = rows.find((r) => r.id === created.id); if (row) row.unitLocation = payload.businessLocationId;
    return created;
  };
  const cleanup = () => { restore.reverse().forEach((fn) => fn()); delete require.cache[servicePath]; };
  return { rows, histories, deletedEvents, deletedPush, state, register, cleanup };
}

const payload = { vendorName: 'A', driverName: 'One', driverPhone: '0900000000', vehiclePlate: '51c 12345', vehicleType: 'TRUCK', receivingUnit: 'EMART', businessLocationId: 'loc1', unitConfigId: 'u1', goodsType: 'GENERAL_GOODS', poNumber: 'ABC1234' };

test('re-registration with the same plate and order code replaces the operational row', async () => {
  const ctx = setup();
  try {
    const first = await ctx.register(payload, { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    assert.equal(first.vehiclePlate, '51C12345');
    assert.equal(ctx.histories[0].deviceType, 'MOBILE');
    assert.equal(ctx.histories[0].registrationSource, 'MANUAL');

    const second = await ctx.register({ ...payload, driverName: 'Two', driverPhone: '0911111111', unitConfigId: 'u2', receivingUnit: 'MALL', poNumber: 'abc-1234' }, { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
    assert.notEqual(second.registrationCode, first.registrationCode);
    assert.equal(ctx.rows.length, 1);
    assert.equal(ctx.rows[0].id, second.id);
    assert.deepEqual(ctx.deletedEvents, [first.id]);
    assert.deepEqual(ctx.deletedPush, [first.registrationCode]);
    assert.equal(ctx.histories.length, 2);
    const old = ctx.histories.find((h) => h.registrationCode === first.registrationCode);
    assert.equal(old.supersededByCode, second.registrationCode);
    assert.ok(old.supersededAt instanceof Date);
    const current = ctx.histories.find((h) => h.registrationCode === second.registrationCode);
    assert.equal(current.supersededAt, undefined);
    assert.equal(current.deviceType, 'DESKTOP');
    assert.equal(current.driverName, 'Two');
  } finally { ctx.cleanup(); }
});

test('same plate with a different order code is rejected without touching the existing row', async () => {
  const ctx = setup();
  try {
    const first = await ctx.register(payload);
    await assert.rejects(ctx.register({ ...payload, poNumber: 'XYZ9999' }), { code: 'VehiclePlateExists', message: 'Biển số xe đã tồn tại!' });
    assert.equal(ctx.rows.length, 1);
    assert.equal(ctx.rows[0].id, first.id);
    assert.equal(ctx.histories.length, 1);
    assert.equal(ctx.histories[0].supersededAt, undefined);
    // Khác khu vực thì vẫn được đăng ký lượt riêng.
    const other = await ctx.register({ ...payload, businessLocationId: 'loc2', unitConfigId: 'u3', poNumber: 'XYZ9999' });
    assert.notEqual(other.registrationCode, first.registrationCode);
    assert.equal(ctx.rows.length, 2);
  } finally { ctx.cleanup(); }
});

test('checked-in, legacy duplicate and archived same-day plates stay blocked; terminal rows allow a new one', async () => {
  const ctx = setup();
  try {
    const first = await ctx.register(payload);
    const row = ctx.rows[0];
    row.status = 'WAITING'; row.checkinTime = new Date();
    await assert.rejects(ctx.register(payload), { code: 'Duplicate' });
    await assert.rejects(ctx.register({ ...payload, poNumber: 'XYZ9999' }), { code: 'Duplicate' });
    row.status = 'CANCELLED';
    const again = await ctx.register(payload);
    assert.notEqual(again.registrationCode, first.registrationCode);
    assert.equal(ctx.rows.length, 2, 'cancelled row is left for the archive job');
    assert.equal(ctx.histories.find((h) => h.registrationCode === first.registrationCode).supersededAt, undefined);
    ctx.rows.push({ ...ctx.rows[1], id: 'legacy-duplicate' });
    await assert.rejects(ctx.register(payload), { code: 'DuplicateRegistrationData' });
    ctx.rows.pop(); ctx.rows[1].status = 'COMPLETED'; ctx.state.archived = true;
    await assert.rejects(ctx.register(payload), { code: 'Duplicate' });
  } finally { ctx.cleanup(); }
});

test('vehicle plates must match the selected vehicle type format', async () => {
  const ctx = setup();
  try {
    await assert.rejects(ctx.register({ ...payload, vehiclePlate: '51C-123' }), { code: 'InvalidVehiclePlate' });
    await assert.rejects(ctx.register({ ...payload, vehiclePlate: '59D255488' }), { code: 'InvalidVehiclePlate' });
    await assert.rejects(ctx.register({ ...payload, vehiclePlate: '' }), { code: 'VehiclePlateRequired' });
    const truck = await ctx.register({ ...payload, vehiclePlate: '51G-4938' });
    assert.equal(truck.vehiclePlate, '51G4938');
    const bike = await ctx.register({ ...payload, vehiclePlate: '59d2-554.88', vehicleType: 'MOTORBIKE', businessLocationId: 'loc2' });
    assert.equal(bike.vehiclePlate, '59D255488');
    const electric = await ctx.register({ ...payload, vehiclePlate: '63aa24593', vehicleType: 'MOTORBIKE', businessLocationId: 'loc3' });
    assert.equal(electric.vehiclePlate, '63AA24593');
    // 51G4938 chỉ có 3 số sau seri G4 nên không phải biển xe máy.
    await assert.rejects(ctx.register({ ...payload, vehiclePlate: '51G4938', vehicleType: 'MOTORBIKE' }), { code: 'InvalidVehiclePlate' });
  } finally { ctx.cleanup(); }
});
