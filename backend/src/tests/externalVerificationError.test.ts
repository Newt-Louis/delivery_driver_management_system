import assert from 'node:assert/strict';
import test from 'node:test';
import { externalVerificationHttpError } from '../modules/deliveries/externalVerificationError';

test('external verification separates unavailable services from a missing code', () => {
  for (const status of [400, 401, 403, 429, 500, 503]) {
    const error = externalVerificationHttpError(status, 'PO');
    assert.ok(error);
    assert.notEqual(error.code, 'NotFound');
  }
  assert.equal(externalVerificationHttpError(404, 'PO')?.code, 'NotFound');
  assert.equal(externalVerificationHttpError(404, 'CONSTRUCTION')?.message, 'Mã Thi Công không tồn tại');
  assert.equal(externalVerificationHttpError(200, 'PO'), null);
});
