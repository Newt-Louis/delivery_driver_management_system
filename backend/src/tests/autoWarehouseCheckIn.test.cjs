const assert = require('node:assert/strict');
const test = require('node:test');

test('check-in rechecks scoped vendor before issuing ticket and stores classification', async (t) => {
  const prismaPath = require.resolve('../lib/prisma.ts');
  const ticketPath = require.resolve('../services/ticketSequence.ts');
  const historyPath = require.resolve('../modules/history/historyService.ts');
  for (const path of [prismaPath, ticketPath, historyPath]) require(path);
  const original = [prismaPath, ticketPath, historyPath].map((path) => require.cache[path].exports);
  let current = { id: 'delivery', status: 'REGISTERED', vendorCode: ' ncc1 ', unitConfigId: 'unit-id', receivingUnit: 'EMART', vehicleType: 'TRUCK', goodsType: 'GENERAL_GOODS', originalGoodsType: 'GENERAL_GOODS' };
  let active = true;
  let ticketCalls = 0;
  let event;
  const tx = {
    $queryRaw: async () => [],
    deliveryRegistration: {
      findUnique: async () => current,
      update: async ({ data }) => ({ ...current, ...data }),
    },
    autoWarehouseVendor: { findFirst: async ({ where }) => {
      assert.deepEqual(where, { vendorCode: 'NCC1', unit: 'EMART', unitConfigId: 'unit-id', active: true });
      return active ? { id: 'vendor' } : null;
    } },
  };
  require.cache[prismaPath].exports = { prisma: { $transaction: async (callback) => callback(tx) } };
  require.cache[ticketPath].exports = { reserveTicketNumber: async () => { ticketCalls++; return 1; } };
  require.cache[historyPath].exports = { recordDeliveryEvent: async (_delivery, data) => { event = data; } };
  t.after(() => [prismaPath, ticketPath, historyPath].forEach((path, index) => { require.cache[path].exports = original[index]; }));
  const { checkInDelivery } = require('../services/checkInDelivery.ts');
  const first = await checkInDelivery({ deliveryId: 'delivery', resultArgs: {} });
  assert.equal(first.delivery.goodsType, 'AUTO_WAREHOUSE');
  assert.equal(first.delivery.autoWarehouse, true);
  assert.equal(first.delivery.status, 'WAITING');
  assert.equal(event.metadata.goodsType, 'AUTO_WAREHOUSE');
  active = false;
  current = { ...current, goodsType: 'AUTO_WAREHOUSE', originalGoodsType: 'FRESH_FOOD' };
  const second = await checkInDelivery({ deliveryId: 'delivery', resultArgs: {} });
  assert.equal(second.delivery.goodsType, 'FRESH_FOOD');
  assert.equal(second.delivery.autoWarehouse, false);
  current = { ...current, originalGoodsType: null };
  await assert.rejects(checkInDelivery({ deliveryId: 'delivery', resultArgs: {} }), { code: 'OriginalGoodsTypeUnknown' });
  assert.equal(ticketCalls, 2);
  current = { ...current, status: 'WAITING' };
  assert.equal((await checkInDelivery({ deliveryId: 'delivery', resultArgs: {} })).checkedIn, false);
  assert.equal(ticketCalls, 2);
});
