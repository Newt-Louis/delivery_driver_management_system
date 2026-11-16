import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOverrideDeliveryWindow,
  formatDeliveryWindows,
  isWithinDeliveryWindows,
  vnMinutesOfDay,
} from '../services/deliveryWindowPolicy';

// 2026-11-16 là ngày bất kỳ; giờ Việt Nam = UTC+7.
const vnTime = (hhmm: string) => new Date(`2026-11-16T${hhmm}:00+07:00`);
const windows = [
  { startTime: '06:00', endTime: '08:00', label: 'Sáng' },
  { startTime: '14:00', endTime: '16:00', label: null },
];

test('VN minutes of day ignore server timezone', () => {
  assert.equal(vnMinutesOfDay(vnTime('00:05')), 5);
  assert.equal(vnMinutesOfDay(vnTime('23:59')), 23 * 60 + 59);
});

test('no enabled window means check-in is allowed all day', () => {
  assert.equal(isWithinDeliveryWindows([], vnTime('03:00')), true);
});

test('check-in is allowed only inside a window, both ends inclusive', () => {
  assert.equal(isWithinDeliveryWindows(windows, vnTime('05:59')), false, 'early arrival');
  assert.equal(isWithinDeliveryWindows(windows, vnTime('06:00')), true);
  assert.equal(isWithinDeliveryWindows(windows, vnTime('08:00')), true);
  assert.equal(isWithinDeliveryWindows(windows, vnTime('08:01')), false);
  assert.equal(isWithinDeliveryWindows(windows, vnTime('15:30')), true);
  assert.equal(isWithinDeliveryWindows(windows, vnTime('16:01')), false);
});

test('only ADMIN_OPE and higher roles may confirm out-of-window check-in', () => {
  assert.equal(canOverrideDeliveryWindow('ADMIN_OPE'), true);
  assert.equal(canOverrideDeliveryWindow('ADMIN_LOC'), true);
  assert.equal(canOverrideDeliveryWindow('SUPERADMIN'), true);
  assert.equal(canOverrideDeliveryWindow('CHECKIN'), false);
  assert.equal(canOverrideDeliveryWindow('RECEIVING'), false);
  assert.equal(canOverrideDeliveryWindow(undefined), false);
});

test('windows are formatted for staff messages', () => {
  assert.equal(formatDeliveryWindows(windows), '06:00–08:00, 14:00–16:00');
});
