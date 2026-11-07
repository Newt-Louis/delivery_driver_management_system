import assert from 'node:assert/strict';
import test from 'node:test';
import { canSelectPublicLocation } from '../src/lib/publicLocationAccess.ts';

test('public location selection is available to guests and superadmins after auth loads', () => {
  assert.equal(canSelectPublicLocation(false, false), true);
  assert.equal(canSelectPublicLocation(false, true, 'SUPERADMIN'), true);
  for (const role of ['ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN']) {
    assert.equal(canSelectPublicLocation(false, true, role), false, role);
  }
  assert.equal(canSelectPublicLocation(true, false), false);
  assert.equal(canSelectPublicLocation(true, true, 'SUPERADMIN'), false);
  assert.equal(canSelectPublicLocation(false, true), false);
});
