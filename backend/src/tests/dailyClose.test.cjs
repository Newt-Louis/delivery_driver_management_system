const test = require('node:test');
const assert = require('node:assert/strict');

test('scheduled business date is previous Vietnam calendar day across boundaries', () => {
  const { previousVietnamBusinessDate } = require('../modules/scheduler/schedulerService.ts');
  assert.equal(previousVietnamBusinessDate(new Date('2026-11-05T17:00:00Z')), '2026-11-05');
  assert.equal(previousVietnamBusinessDate(new Date('2027-01-01T00:15:00+07:00')), '2026-12-31');
  assert.equal(previousVietnamBusinessDate(new Date('2028-03-01T00:00:00+07:00')), '2028-02-29');
});

test('daily close locks and rechecks each delivery and archives within its transaction', async () => {
  function replace(path, overrides) {
    const file = require.resolve(path); const original = require(file);
    require.cache[file].exports = { ...original, ...overrides };
    return () => { require.cache[file].exports = original; };
  }
  const rows = [
    { id: 'a', status: 'REGISTERED', registrationCode: 'A', vehiclePlate: 'A' },
    { id: 'b', status: 'REGISTERED', registrationCode: 'B', vehiclePlate: 'B' },
    { id: 'c', status: 'RECEIVING', registrationCode: 'C', vehiclePlate: 'C' },
  ];
  const calls = []; let finished;
  const prisma = {
    deliveryRegistration: { findMany: async () => rows },
    $transaction: async (fn) => {
      const tx = {
        $queryRaw: async (sql) => { assert.ok(sql.sql.includes('FOR UPDATE')); calls.push('lock'); },
        deliveryRegistration: {
          findFirst: async ({ where }) => {
            const id = where.AND[1].id; calls.push(`read:${id}`);
            return id === 'b' ? null : rows.find((row) => row.id === id);
          },
          update: async ({ where, data }) => { calls.push(`update:${where.id}:${data.status}`); },
        },
      };
      return fn(tx);
    },
  };
  const restore = [];
  restore.push(replace('../lib/prisma.ts', { prisma }));
  restore.push(replace('../modules/history/archiveService.ts', { archiveDeliveryInTransaction: async (tx, input) => {
    assert.ok(tx.deliveryRegistration); calls.push(`archive:${input.deliveryId}:${input.finalStatus}`);
    return { deleted: true };
  } }));
  restore.push(replace('../modules/scheduler/jobHistory.ts', {
    startSchedulerJobHistory: async () => ({ id: 'job' }),
    finishSchedulerJobHistory: async (input) => { finished = input; },
  }));
  restore.push(replace('../services/webPush.ts', { sendPushToDelivery: async () => {} }));
  const file = require.resolve('../modules/scheduler/deliveryJobs.ts'); delete require.cache[file];
  try {
    const result = await require(file).closeDailyDeliveries({ businessDate: '2026-11-05' });
    assert.deepEqual(calls, ['lock', 'read:a', 'update:a:EXPIRED', 'archive:a:EXPIRED', 'lock', 'read:b', 'lock', 'read:c', 'update:c:INCOMPLETED', 'archive:c:INCOMPLETED']);
    assert.equal(result.processed, 3); assert.equal(result.succeeded, 2); assert.equal(result.failed, 0);
    assert.equal(finished.metadata.skipped, 1);
  } finally { restore.reverse().forEach((fn) => fn()); delete require.cache[file]; }
});
