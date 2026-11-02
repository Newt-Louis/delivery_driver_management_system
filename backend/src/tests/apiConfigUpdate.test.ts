import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareApiConfigUpdate } from '../modules/superadmin/apiConfigUpdate';
import { SuperadminFormRequest } from '../modules/superadmin/superadminFormRequest';

const existing = { key: 'api.settings.po_verify', isRuntimeEditable: true, value: {
  endpoint: 'https://example.test', method: 'POST', auth: { type: 'bearer', header: 'Authorization: Bearer secret' },
  payload_defaults: { BUKRS: 'VN01' }, code_key: 'code', site_location_map: { '1001': 'PVT' },
} };

test('changing the key preserves fields and credentials omitted by the masked form', () => {
  const result = prepareApiConfigUpdate(existing, SuperadminFormRequest.parseApiConfigUpdate({ name: 'thi_cong_verify' }));
  assert.equal(result.key, 'api.settings.thi_cong_verify');
  assert.deepEqual(result.value, existing.value);
});

test('updates only supplied fields and keeps additional configuration', () => {
  const result = prepareApiConfigUpdate(existing, SuperadminFormRequest.parseApiConfigUpdate({ name: 'po_verify', endpoint: 'https://new.example.test', auth: { type: 'none' } }));
  assert.equal(result.value.endpoint, 'https://new.example.test');
  assert.deepEqual(result.value.auth, { type: 'none' });
  assert.deepEqual((result.value as Record<string, unknown>).payload_defaults, existing.value.payload_defaults);
});

test('rejects locked configurations and unsupported destination keys', () => {
  assert.throws(() => prepareApiConfigUpdate({ ...existing, isRuntimeEditable: false }, { name: 'thi_cong_verify' }));
  assert.throws(() => prepareApiConfigUpdate(existing, { name: 'unknown' }));
});
