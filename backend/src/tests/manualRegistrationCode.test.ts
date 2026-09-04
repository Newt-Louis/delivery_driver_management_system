import assert from 'node:assert/strict';
import test from 'node:test';
import { generateManualRegistrationCode } from '../modules/deliveries/manualRegistrationCode';

test('manual registration code is seven uppercase alphanumeric characters', () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generateManualRegistrationCode(), /^[A-Z0-9]{7}$/);
  }
});
