import assert from 'node:assert/strict';
import test from 'node:test';
import { canOfferManualRegistration } from '../src/features/register-manual/quickVerifyErrors.ts';

test('manual registration is offered for service errors, not normal validation failures', () => {
  for (const code of ['ExternalApiRequestFailed', 'ExternalApiServerError', 'ExternalApiConnectionFailed', 'ExternalApiUnauthorized', 'ExternalApiEmptyResponse', 'PoItemsMissing', 'ConstructionScopeMissing']) {
    assert.equal(canOfferManualRegistration({ response: { status: 400, data: { error: code } } }), true, code);
  }
  for (const status of [500, 502, 503]) {
    assert.equal(canOfferManualRegistration({ response: { status } }), true);
  }
  assert.equal(canOfferManualRegistration({ response: { status: 404, data: { error: 'NotFound' } } }), false);
  assert.equal(canOfferManualRegistration({ response: { status: 400, data: { error: 'BadRequest' } } }), false);
  assert.equal(canOfferManualRegistration({}), false);
});
