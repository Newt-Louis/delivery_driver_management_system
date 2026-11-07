const assert = require('node:assert/strict');
const test = require('node:test');

test('vendor edits enforce the target unit scope and unique code', async (t) => {
  const prismaPath = require.resolve('../lib/prisma.ts');
  require(prismaPath);
  const original = require.cache[prismaPath].exports;
  const originalVendor = { id: 'vendor-1', unitConfigId: 'unit-1', unit: 'EMART', vendorCode: 'OLD', unitConfig: { id: 'unit-1', unit: 'EMART', businessLocationId: 'location-1' } };
  const units = [originalVendor.unitConfig, { id: 'unit-2', unit: 'MALL', businessLocationId: 'location-1' }];
  let duplicate = false;
  let updateData;
  require.cache[prismaPath].exports = { prisma: {
    autoWarehouseVendor: {
      findUnique: async () => originalVendor,
      findFirst: async ({ where }) => {
        assert.equal(where.id.not, 'vendor-1');
        return duplicate ? { id: 'other' } : null;
      },
      update: async ({ data }) => { updateData = data; return { ...originalVendor, ...data }; },
    },
    unitConfig: { findMany: async () => units },
  } };
  t.after(() => { require.cache[prismaPath].exports = original; });
  const router = require('../routes/awVendors.ts').default;
  const layer = router.stack.find((entry) => entry.route?.path === '/:id' && entry.route.methods.patch);
  const handler = layer.route.stack.at(-1).handle;
  async function request(body) {
    return new Promise((resolve, reject) => {
      const req = { params: { id: 'vendor-1' }, body, scope: { businessLocationId: 'location-1' }, user: { role: 'SUPERADMIN' } };
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { resolve({ status: this.statusCode, data }); } };
      handler(req, res, reject);
    });
  }
  const updated = await request({ unitConfigId: 'unit-2', vendorCode: ' new-code ', vendorName: 'Supplier' });
  assert.equal(updated.status, 200);
  assert.equal(updateData.unitConfigId, 'unit-2');
  assert.equal(updateData.unit, 'MALL');
  assert.equal(updateData.vendorCode, 'NEW-CODE');
  duplicate = true;
  assert.equal((await request({ unitConfigId: 'unit-2', vendorCode: 'new-code' })).status, 409);
  duplicate = false;
  assert.equal((await request({ unitConfigId: 'foreign-unit' })).status, 400);
});
