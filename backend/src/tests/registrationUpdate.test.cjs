const test = require('node:test');
const assert = require('node:assert/strict');

test('registration updates a plate within its location and preserves its code', async () => {
  function replace(path, overrides) {
    const file = require.resolve(path); const original = require(file);
    require.cache[file].exports = { ...original, ...overrides };
    return () => { require.cache[file].exports = original; };
  }
  const rows = []; let sequence = 0; let archived = false;
  const tx = {
    $executeRaw: async () => {}, $queryRaw: async () => [],
    deliveryHistory: { findFirst: async () => archived ? { id: 'old' } : null },
    deliveryRegistration: {
      findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
      update: async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data),
      create: async ({ data }) => { const row = { ...data, id: `d${rows.length}`, status: 'REGISTERED', checkinTime: null, createdAt: new Date() }; rows.push(row); return row; },
    },
    auditLog: { create: async () => ({}) },
  };
  const restore = [];
  restore.push(replace('../modules/deliveries/deliveryRepository.ts', {
    prisma: { $transaction: async (fn) => fn(tx) },
    resolveRegistrationUnitConfig: async ({ unitConfigId, businessLocationId }) => ({ id: unitConfigId, businessLocationId, businessLocation: { code: 'L1' }, sundayFreshFoodOnly: false }),
    findDuplicateRegistration: async ({ vehiclePlate, businessLocationId }) => rows.filter((r) => r.vehiclePlate === vehiclePlate && r.location === businessLocationId && !['COMPLETED', 'CANCELLED'].includes(r.status)),
    getRegistrationDailyCapacity: async () => null, getFullQueue: async () => [],
  }));
  restore.push(replace('../services/registrationSequence.ts', { reserveRegistrationCode: async () => `CODE${++sequence}` }));
  restore.push(replace('../modules/history/historyService.ts', { recordDeliveryEvent: async () => {} }));
  restore.push(replace('../socket/index.ts', { emitQueueUpdated: () => {} }));
  restore.push(replace('../services/trackRealtime.ts', { emitTrackUpdated: async () => {} }));
  const servicePath = require.resolve('../modules/deliveries/deliveryService.ts'); delete require.cache[servicePath];
  const { registerDelivery } = require(servicePath);
  const payload = { vendorName: 'A', driverName: 'One', driverPhone: '0900000000', vehiclePlate: '51C 12345', vehicleType: 'TRUCK', receivingUnit: 'EMART', businessLocationId: 'loc1', unitConfigId: 'u1', goodsType: 'GENERAL_GOODS', poNumber: 'ABC1234' };
  try {
    const first = await registerDelivery(payload); first.location = 'loc1';
    const updated = await registerDelivery({ ...payload, driverName: 'Two', driverPhone: '0911111111', unitConfigId: 'u2', receivingUnit: 'MALL', poNumber: 'NEW1234' });
    assert.equal(updated.id, first.id); assert.equal(updated.registrationCode, 'CODE1');
    assert.equal(updated.driverName, 'Two'); assert.equal(updated.unitConfigId, 'u2'); assert.equal(rows.length, 1);
    const other = await registerDelivery({ ...payload, businessLocationId: 'loc2', unitConfigId: 'u3' }); other.location = 'loc2';
    assert.notEqual(other.registrationCode, first.registrationCode); assert.equal(rows.length, 2);
    first.status = 'WAITING'; first.checkinTime = new Date();
    await assert.rejects(registerDelivery(payload), { code: 'Duplicate' });
    first.status = 'CANCELLED';
    const again = await registerDelivery(payload); again.location = 'loc1';
    assert.notEqual(again.registrationCode, first.registrationCode);
    again.status = 'COMPLETED';
    const afterComplete = await registerDelivery(payload); afterComplete.location = 'loc1';
    assert.notEqual(afterComplete.registrationCode, again.registrationCode);
    rows.push({ ...afterComplete, id: 'legacy-duplicate' });
    await assert.rejects(registerDelivery(payload), { code: 'DuplicateRegistrationData' });
    rows.pop(); afterComplete.status = 'COMPLETED'; archived = true;
    await assert.rejects(registerDelivery(payload), { code: 'Duplicate' });
  } finally { restore.reverse().forEach((fn) => fn()); delete require.cache[servicePath]; }
});
