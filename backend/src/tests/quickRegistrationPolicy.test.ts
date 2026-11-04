import assert from 'node:assert/strict';
import test from 'node:test';
import { assertConstructionDateRange, assertPoDateIsToday, assertQuickRegistrationDate, assertRegistrationDateIsToday, requiresQuickVerification } from '../modules/deliveries/quickRegistrationPolicy';

test('construction dates include both boundaries and follow the Vietnam calendar day', () => {
  const start = '2026-11-04';
  const end = '2026-11-06';
  assert.throws(() => assertConstructionDateRange(start, end, new Date('2026-11-03T16:59:59Z')));
  assert.doesNotThrow(() => assertConstructionDateRange(start, end, new Date('2026-11-03T17:00:00Z')));
  assert.doesNotThrow(() => assertConstructionDateRange(start, end, new Date('2026-11-06T16:59:59Z')));
  assert.throws(() => assertConstructionDateRange(start, end, new Date('2026-11-06T17:00:00Z')));
  for (const [invalidStart, invalidEnd] of [[null, end], [start, null], ['2026-02-30', end], [end, start], ['2026-11-04T00:00:00Z', end]]) {
    assert.throws(() => assertConstructionDateRange(invalidStart, invalidEnd));
  }
});

test('PO date follows Vietnam business day across UTC midnight', () => {
  const now = new Date('2026-11-02T17:01:00Z');
  assert.doesNotThrow(() => assertPoDateIsToday('2026-11-03', now));
  assert.throws(() => assertPoDateIsToday('2026-11-02', now));
  assert.throws(() => assertPoDateIsToday('2026-11-04', now));
});

test('quick registration requires current server day, token day and requested timestamp to agree', () => {
  const now = new Date('2026-11-02T17:01:00Z');
  const today = new Date('2026-11-02T17:00:00Z');
  const yesterday = new Date('2026-11-02T16:59:00Z');
  assert.doesNotThrow(() => assertQuickRegistrationDate('2026-11-03', today, '2026-11-03', now));
  assert.throws(() => assertQuickRegistrationDate('2026-11-02', yesterday, '2026-11-03', now));
  assert.throws(() => assertQuickRegistrationDate('2026-11-03', yesterday, '2026-11-03', now));
  assert.throws(() => assertQuickRegistrationDate('2026-11-03', today, '2026-11-02', now));
  assert.throws(() => assertQuickRegistrationDate(undefined, null, '2026-11-03', now));
});

test('PO and construction code shapes require verification while manual reference codes remain supported', () => {
  assert.equal(requiresQuickVerification('4500000001'), true);
  assert.equal(requiresQuickVerification(' Ab12C '), true);
  assert.equal(requiresQuickVerification('A B12C'), true);
  assert.equal(requiresQuickVerification('A-B12C'), true);
  assert.equal(requiresQuickVerification('A1B2C3D'), false);
});

test('manual and other registrations accept only the current Vietnam calendar day', () => {
  for (const now of ['2026-11-02T16:00:00Z', '2026-11-02T17:00:00Z', '2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z', '2026-11-02T20:00:00Z']) {
    const current = new Date(now);
    const today = now.endsWith('16:00:00Z') ? '2026-11-02' : '2026-11-03';
    assert.doesNotThrow(() => assertRegistrationDateIsToday(today, current, current));
    assert.throws(() => assertRegistrationDateIsToday('2026-11-01', current, current));
    assert.throws(() => assertRegistrationDateIsToday('2026-11-04', current, current));
    assert.throws(() => assertRegistrationDateIsToday(today, new Date('2026-11-01T00:00:00Z'), current));
  }
  assert.throws(() => assertRegistrationDateIsToday('2026-11-02', new Date('2026-11-02T16:59:59Z'), new Date('2026-11-02T17:00:00Z')));
});
