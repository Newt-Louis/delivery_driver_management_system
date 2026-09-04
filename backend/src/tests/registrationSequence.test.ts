import assert from 'node:assert/strict';
import test from 'node:test';
import { formatRegistrationCode, registrationCodePrefix, reserveRegistrationCode } from '../services/registrationSequence';

test('registration code uses the business location, unit config suffix, date, and sequence', () => {
  const code = formatRegistrationCode({
    businessLocationCode: 'pvt',
    unitConfigId: 'cmscs92gv0000sldgn0jw4lx4',
    registrationDate: '2026-09-04',
    sequenceNumber: 1,
  });

  assert.equal(code, 'PVT4LX4260904001');
});

test('same unit-config suffix at different business locations has a distinct prefix', () => {
  const base = {
    unitConfigId: 'cmscs92gv0000sldgn0jw4lx4',
    registrationDate: '2026-09-04',
  };

  assert.notEqual(
    registrationCodePrefix({ ...base, businessLocationCode: 'PVT' }),
    registrationCodePrefix({ ...base, businessLocationCode: 'SALA' }),
  );
});

test('sequence state is keyed by the registration date and UnitConfig', async () => {
  let upsertArgs: { where: unknown } | undefined;
  const transaction = {
    deliveryRegistration: {
      findMany: async () => [],
    },
    registrationSequence: {
      upsert: async (args: { where: unknown; create: { nextNumber: number } }) => {
        upsertArgs = args;
        return { nextNumber: args.create.nextNumber };
      },
    },
  };

  const code = await reserveRegistrationCode(transaction as never, {
    businessLocationCode: 'PVT',
    unitConfigId: 'cmscs92gv0000sldgn0jw4lx4',
    receivingUnit: 'THISKYHALL',
  }, new Date('2026-09-04T03:00:00.000Z'));

  assert.equal(code, 'PVT4LX4260904001');
  assert.deepEqual(upsertArgs?.where, {
    registrationDate_unitConfigId: {
      registrationDate: '2026-09-04',
      unitConfigId: 'cmscs92gv0000sldgn0jw4lx4',
    },
  });
});
