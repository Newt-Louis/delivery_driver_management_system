import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { loadLocationCodeGroups, locationGroupsFilePath, mapPoLocationCode, parseLocationCodeGroups, resolveLocationByCode } from '../modules/deliveries/locationCodeGroups';

const file = path.resolve(__dirname, '../../../codeofconduct_location.json');
const groups = parseLocationCodeGroups(JSON.parse(fs.readFileSync(file, 'utf8')));
const locations = [
  { id: 'sal', code: 'SAL', locationName: 'Sala' },
  { id: 'pvt', code: 'PVT', locationName: 'PVT' },
  { id: 'phi', code: 'PHI', locationName: 'PHI' },
  { id: 'tht', code: 'THT', locationName: 'THT' },
  { id: 'other', code: 'OTHER', locationName: 'Other' },
];

test('all agreed aliases resolve symmetrically against active location codes', () => {
  for (const [id, codes] of Object.entries({ sal: ['1002', 'SALA', 'SLA', 'SAL'], pvt: ['1001', 'PVT'], phi: ['1003', 'PHI'], tht: ['2001', '1004', 'THT'] })) {
    for (const code of codes) {
      assert.equal(resolveLocationByCode(` ${code.toLowerCase()} `, locations, groups).id, id);
      for (const storedCode of codes) {
        assert.equal(resolveLocationByCode(code, [{ id, code: storedCode, locationName: id }], groups).id, id);
      }
    }
  }
  assert.equal(resolveLocationByCode('other', locations, groups).id, 'other');
  assert.throws(() => resolveLocationByCode('unknown', locations, groups), { code: 'LocationCodeNotFound' });
});

test('group name counts as an alias even if omitted from its list', () => {
  const aliases = parseLocationCodeGroups({ SALA: ['1002', 'SAL'] });
  assert.equal(resolveLocationByCode('sala', [locations[0]], aliases).id, 'sal');
});

test('multiple active locations in one group fail closed even if one code matches exactly', () => {
  assert.throws(() => resolveLocationByCode('SALA', [...locations, { id: 'duplicate', code: 'SALA', locationName: 'Duplicate' }], groups), { code: 'LocationCodeAmbiguous' });
});

test('configuration rejects bad JSON shapes and aliases shared by different groups', () => {
  for (const value of [null, [], {}, { A: 'x' }, { A: [42] }, { A: ['  '] }, { A: ['x'], B: [' X '] }, { A: ['B'], B: [] }]) {
    assert.throws(() => parseLocationCodeGroups(value));
  }
});

test('a missing configured file fails explicitly instead of falling back silently', () => {
  const old = process.env.LOCATION_CODE_GROUPS_FILE;
  process.env.LOCATION_CODE_GROUPS_FILE = path.join(file, 'missing.json');
  try {
    assert.throws(() => loadLocationCodeGroups(), /Không thể tải danh mục mã khu vực/);
  } finally {
    if (old === undefined) delete process.env.LOCATION_CODE_GROUPS_FILE;
    else process.env.LOCATION_CODE_GROUPS_FILE = old;
  }
});

test('default path points to the repository JSON when no override is configured', () => {
  const old = process.env.LOCATION_CODE_GROUPS_FILE;
  delete process.env.LOCATION_CODE_GROUPS_FILE;
  try {
    assert.equal(locationGroupsFilePath(), file);
    assert.equal(loadLocationCodeGroups().get('1002'), 'SALA');
  } finally {
    if (old !== undefined) process.env.LOCATION_CODE_GROUPS_FILE = old;
  }
});

test('existing PO mappings stay compatible only when they do not contradict a known group', () => {
  assert.equal(mapPoLocationCode('1002', { '1002': 'SALA' }, groups), 'SALA');
  assert.equal(mapPoLocationCode('1002', {}, groups), '1002');
  assert.equal(mapPoLocationCode('LEGACY', { LEGACY: 'SAL' }, groups), 'SAL');
  assert.throws(() => mapPoLocationCode('1002', { '1002': ' ' }, groups), { code: 'LocationMappingConflict' });
  assert.throws(() => mapPoLocationCode('1002', { '1002': 'PVT' }, groups), { code: 'LocationMappingConflict' });
  assert.throws(() => mapPoLocationCode('1002', { '1002': 'UNKNOWN' }, groups), { code: 'LocationMappingConflict' });
});
