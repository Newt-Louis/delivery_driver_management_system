const test = require('node:test');
const assert = require('node:assert/strict');

test('archive job keeps completed history, creates missing history, and retains cancellation cutoff', async () => {
  function replace(path, overrides) {
    const file = require.resolve(path); const original = require(file);
    require.cache[file].exports = { ...original, ...overrides };
    return () => { require.cache[file].exports = original; };
  }
  const candidates = [
    { id: 'completed-saved', status: 'COMPLETED' },
    { id: 'completed-missing', status: 'COMPLETED' },
    { id: 'completed-mismatch', status: 'COMPLETED' },
    { id: 'cancelled', status: 'CANCELLED', cancelReason: 'reason' },
  ];
  let query, selectedIds, finished; const archived = [];
  const prisma = {
    deliveryRegistration: { findMany: async (args) => { query = args; return candidates; } },
    deliveryHistory: { findMany: async (args) => { selectedIds = args.where.originalDeliveryId.in; return [
      { originalDeliveryId: 'completed-saved', finalStatus: 'COMPLETED' },
      { originalDeliveryId: 'completed-mismatch', finalStatus: 'CANCELLED' },
    ]; } },
    $transaction: async (fn) => fn({ $queryRaw: async (sql) => {
      if (sql.sql.includes('FOR SHARE')) return [{ id: 'history-id' }];
      assert.ok(sql.sql.includes('EXISTS')); assert.ok(sql.sql.includes('COMPLETED')); return [{ id: 'completed-saved' }];
    } }),
  };
  const restore = [];
  restore.push(replace('../lib/prisma.ts', { prisma }));
  restore.push(replace('../modules/history/archiveService.ts', { archiveDelivery: async (input) => { archived.push(input); return { deleted: true }; } }));
  restore.push(replace('../modules/scheduler/jobHistory.ts', {
    startSchedulerJobHistory: async (input) => { assert.equal(input.jobName, 'archive-deliveries'); return { id: 'job' }; },
    finishSchedulerJobHistory: async (input) => { finished = input; },
  }));
  const modulePath = require.resolve('../modules/scheduler/deliveryJobs.ts'); delete require.cache[modulePath];
  try {
    const { archiveDeliveries } = require(modulePath);
    const result = await archiveDeliveries();
    assert.deepEqual(selectedIds, ['completed-saved', 'completed-missing', 'completed-mismatch']);
    assert.equal(query.where.OR[1].status, 'CANCELLED');
    assert.ok(query.where.OR[1].updatedAt.lte instanceof Date);
    assert.deepEqual(archived.map((item) => [item.deliveryId, item.expectedStatus]), [['completed-missing', 'COMPLETED'], ['cancelled', 'CANCELLED']]);
    assert.equal(result.succeeded, 3); assert.equal(result.failed, 1); assert.equal(result.processed, 4);
    assert.equal(finished.status, 'FAILED');
  } finally { restore.reverse().forEach((fn) => fn()); delete require.cache[modulePath]; }
});
