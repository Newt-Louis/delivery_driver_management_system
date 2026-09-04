import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import type { AuthUser } from '../middleware/auth';
import { enforceResourceScope, enforceScope } from '../middleware/auth';
import { resolveProtectedSocketScope } from '../socket';

const CURRENT_LOCATION = 'cmscs92gv0000sldgn0jw4lx4';
const OTHER_LOCATION = 'singleton';
const CURRENT_UNIT = 'unit-current';
const OTHER_UNIT = 'unit-other';

function authUser(role: AuthUser['role']): AuthUser {
  return {
    id: `user-${role}`,
    email: `${role.toLowerCase()}@test.local`,
    role,
    name: role,
    unit: null,
    businessLocationId: CURRENT_LOCATION,
    operationUnits: [
      {
        id: CURRENT_UNIT,
        code: 'EMART',
        displayName: 'Current unit',
        shortName: 'Current',
        icon: null,
        businessLocationId: CURRENT_LOCATION,
        isActive: true,
      },
      {
        id: OTHER_UNIT,
        code: 'EMART',
        displayName: 'Other unit',
        shortName: 'Other',
        icon: null,
        businessLocationId: OTHER_LOCATION,
        isActive: true,
      },
    ],
    manageableUnits: [],
    unitPermissions: [],
    capabilities: [],
  };
}

function middlewareHarness(user: AuthUser, query: Record<string, string> = {}) {
  const req = { user, query } as unknown as Request;
  const result: { status?: number; body?: unknown; next: boolean } = { next: false };
  const res = {
    status(status: number) {
      result.status = status;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  } as unknown as Response;
  const next = (() => { result.next = true; }) as NextFunction;
  return { req, res, next, result };
}

test('SUPERADMIN REST scope comes from the selected session location', () => {
  const harness = middlewareHarness(authUser('SUPERADMIN'));
  enforceScope(harness.req, harness.res, harness.next);

  assert.equal(harness.result.next, true);
  assert.deepEqual(harness.req.scope, { businessLocationId: CURRENT_LOCATION, unitConfigId: undefined });
});

test('REST scope rejects a stale BusinessLocation query instead of overriding the session', () => {
  const harness = middlewareHarness(authUser('SUPERADMIN'), { businessLocationId: OTHER_LOCATION });
  enforceScope(harness.req, harness.res, harness.next);

  assert.equal(harness.result.next, false);
  assert.equal(harness.result.status, 403);
  assert.equal(harness.req.scope, undefined);
});

test('REST scope rejects a UnitConfig outside the current BusinessLocation', () => {
  const harness = middlewareHarness(authUser('ADMIN_OPE'), { unitConfigId: OTHER_UNIT });
  enforceScope(harness.req, harness.res, harness.next);

  assert.equal(harness.result.next, false);
  assert.equal(harness.result.status, 403);
});

for (const role of ['ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN'] as const) {
  test(`${role} cannot override its assigned BusinessLocation through query params`, () => {
    const harness = middlewareHarness(authUser(role), { businessLocationId: OTHER_LOCATION });
    enforceScope(harness.req, harness.res, harness.next);

    assert.equal(harness.result.next, false);
    assert.equal(harness.result.status, 403);
    assert.equal(harness.req.scope, undefined);
  });
}

test('resource checks do not let SUPERADMIN bypass the selected operational location', () => {
  const harness = middlewareHarness(authUser('SUPERADMIN'));
  const allowed = enforceResourceScope(harness.req, harness.res, OTHER_LOCATION);

  assert.equal(allowed, false);
  assert.equal(harness.result.status, 403);
});

test('protected socket rejects a client-supplied stale BusinessLocation', () => {
  assert.throws(
    () => resolveProtectedSocketScope({ businessLocationId: OTHER_LOCATION }, authUser('SUPERADMIN')),
    /scope_mismatch/,
  );
});

test('protected SUPERADMIN socket uses the selected session location', () => {
  assert.deepEqual(
    resolveProtectedSocketScope({}, authUser('SUPERADMIN')),
    { businessLocationId: CURRENT_LOCATION },
  );
});

test('unit-scoped socket joins only active permitted units in the current location', () => {
  assert.deepEqual(
    resolveProtectedSocketScope({}, authUser('RECEIVING')),
    { unitConfigIds: [CURRENT_UNIT] },
  );
});

test('unit-scoped socket rejects an explicit foreign UnitConfig', () => {
  assert.throws(
    () => resolveProtectedSocketScope({ unitConfigId: OTHER_UNIT }, authUser('RECEIVING')),
    /invalid_unit_scope/,
  );
});
