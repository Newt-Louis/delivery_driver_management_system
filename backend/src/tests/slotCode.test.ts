import test from 'node:test';
import assert from 'node:assert/strict';
import { compareSlotNames, compareSlotsForDisplay, formatSlotCode, nextSlotCodeSequence, normalizeSlotName } from '../domain/slotCode';
import { SlotFormRequest } from '../modules/slots/slotFormRequest';

test('slot code is `<zone code>-<2+ digit sequence>`', () => {
  assert.equal(formatSlotCode('KE-1', 1), 'KE-1-01');
  assert.equal(formatSlotCode('KE-1', 12), 'KE-1-12');
  assert.equal(formatSlotCode('KE-1', 105), 'KE-1-105');
});

test('next sequence is max existing in zone + 1, gaps are not filled and foreign codes are ignored', () => {
  assert.equal(nextSlotCodeSequence('KE-1', []), 1);
  assert.equal(nextSlotCodeSequence('KE-1', ['KE-1-01', 'KE-1-04']), 5);
  assert.equal(nextSlotCodeSequence('KE-1', ['T1', 'E2', 'KE-1-x', 'KE-10-09', 'KE-1-02']), 3);
});

test('slot names sort naturally and display order keeps unit, then truck before motorbike', () => {
  assert.deepEqual(['T10', 'T2', 'T1', 'T9'].sort(compareSlotNames), ['T1', 'T2', 'T9', 'T10']);
  assert.equal(compareSlotNames('t1', 'T1'), 0);
  const slots = [
    { assignedUnit: 'EMART', vehicleType: 'MOTORBIKE', name: 'T1' },
    { assignedUnit: 'EMART', vehicleType: 'TRUCK', name: 'T10' },
    { assignedUnit: 'EMART', vehicleType: 'TRUCK', name: 'T2' },
    { assignedUnit: 'DMALL', vehicleType: 'TRUCK', name: 'T7' },
  ];
  assert.deepEqual([...slots].sort(compareSlotsForDisplay).map((slot) => slot.name), ['T7', 'T2', 'T10', 'T1']);
});

test('slot payload never accepts a client code and trims the name', () => {
  assert.equal(normalizeSlotName('  T1   A '), 'T1 A');
  const payload = SlotFormRequest.parseCreate({ code: 'HACK', name: '  T3 ', assignedUnit: 'emart', zoneId: 'zone' });
  assert.equal('code' in payload, false);
  assert.equal(payload.name, 'T3');
  assert.throws(() => SlotFormRequest.parseCreate({ name: '   ', assignedUnit: 'EMART', zoneId: 'zone' }));
});
