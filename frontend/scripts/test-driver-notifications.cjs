const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(relative, globals = {}) {
  const filename = path.resolve(__dirname, relative);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, Set, Map, WeakMap, console, ...globals }, { filename });
  return exports;
}
const model = loadTs('../src/features/driver-notifications/model.ts');
const trip = { code: 'A', plate: '51F-552.95', status: 'WAITING', seen: [], lastEventAt: '2026-10-27T01:00:00.000Z' };
const called = { deliveryCode: 'A', status: 'CALLED', eventId: 'A:CALLED:2', occurredAt: '2026-10-27T02:00:00.000Z' };

test('only the selected trip alerts; duplicate socket/push and late statuses are rejected', () => {
  assert.equal(model.acceptsNotice(trip, called), true);
  assert.equal(model.acceptsNotice(trip, { ...called, deliveryCode: 'B' }), false);
  assert.equal(model.acceptsNotice({ ...trip, seen: [called.eventId] }, called), false);
  assert.equal(model.acceptsNotice({ ...trip, status: 'CALLED', lastEventAt: called.occurredAt }, { ...called, status: 'WAITING', occurredAt: trip.lastEventAt }), false);
  assert.equal(model.acceptsNotice({ ...trip, status: 'RECEIVING' }, called), false);
});

test('snapshot recovery and backend events share the same call identity', () => {
  const event = model.noticeFromDelivery({ registrationCode: 'A', vehiclePlate: trip.plate, status: 'CALLED', calledTime: called.occurredAt, assignedSlot: { code: 'E2' } });
  assert.equal(event.eventId, 'A:CALLED:' + called.occurredAt);
  assert.match(event.title, /E2/);
  assert.match(event.body, /51F-552.95/);
  assert.equal(model.TERMINAL_STATUSES.has('COMPLETED'), true);
  const recalled = model.noticeFromDelivery({ registrationCode: 'A', vehiclePlate: trip.plate, status: 'CALLED', calledTime: trip.lastEventAt, notificationCalledAt: called.occurredAt, assignedSlot: { code: 'E2' } });
  assert.equal(recalled.eventId, event.eventId, 'recall recovery uses its own event time, not the first call');
  const cancelled = model.noticeFromDelivery({ registrationCode: 'A', status: 'CANCELLED', updatedAt: '2026-10-27T04:00:00.000Z', receivingStartTime: trip.lastEventAt });
  assert.equal(model.acceptsNotice({ ...trip, status: 'RECEIVING', lastEventAt: called.occurredAt }, cancelled), true, 'terminal snapshot cannot inherit an older receiving timestamp');
});

test('closing a chime cancels every scheduled oscillator once', () => {
  const { playChimeWithCtx } = loadTs('../src/lib/chime.ts');
  const nodes = [];
  const ctx = { state: 'running', currentTime: 1, destination: {},
    createOscillator() { const node = { frequency: {}, stops: [], connect() {}, disconnect() {}, start() {}, stop(time) { this.stops.push(time); } }; nodes.push(node); return node; },
    createGain() { return { connect() {}, disconnect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} } }; },
  };
  const handle = playChimeWithCtx(ctx, 10);
  assert.ok(nodes.length > 4);
  assert.ok(nodes.every((node) => node.stops.length === 1), 'every oscillator has a scheduled natural end');
  ctx.currentTime = 2;
  handle.stop();
  handle.stop();
  assert.ok(nodes.every((node) => node.stops.length === 2 && node.stops[1] === 2), 'close cancels all future notes and is idempotent');
});

test('leaving Track cannot release the global notification room; reconnect rejoins once', () => {
  const { retainTrackRoom } = loadTs('../src/lib/trackRoom.ts');
  const sent = [];
  const handlers = new Map();
  const socket = { connected: true, emit: (...args) => sent.push(args), on: (e, f) => handlers.set(e, f), off: (e) => handlers.delete(e) };
  const globalRelease = retainTrackRoom(socket, 'a');
  const detailRelease = retainTrackRoom(socket, 'A');
  assert.equal(sent.length, 1);
  detailRelease();
  assert.equal(sent.length, 1);
  handlers.get('connect')();
  assert.equal(sent.length, 2);
  globalRelease();
  assert.equal(sent[2][0], 'track:leave');
  assert.equal(handlers.size, 0);
  globalRelease();
  assert.equal(sent.length, 3);
});

test('backend socket notification precedes push I/O and terminal cleanup is code-scoped', async () => {
  const events = [];
  const removed = [];
  const { sendPushToDelivery } = loadTs('../../backend/src/services/webPush.ts', {
    process: { env: { VAPID_PUBLIC_KEY: 'test', VAPID_PRIVATE_KEY: 'test' } },
    require: (name) => {
      if (name === 'web-push') return { setVapidDetails() {}, sendNotification: async () => events.push('push') };
      if (name === '../socket') return { getIO: () => ({ to: () => ({ emit: () => events.push('socket') }) }), trackRoomName: (code) => 'track:' + code };
      if (name === '../lib/prisma') return { prisma: { pushSubscription: {
        findMany: async () => { events.push('query'); return [{ endpoint: 'test', p256dh: '', auth: '' }]; },
        deleteMany: async (args) => removed.push(args),
      } } };
      throw new Error(name);
    },
  });
  await sendPushToDelivery('A', { status: 'COMPLETED', title: 'Done', body: 'Done', occurredAt: called.occurredAt });
  assert.deepEqual(events, ['socket', 'query', 'push']);
  assert.equal(removed[0].where.deliveryCode, 'A');
});

test('service worker handles matching foreground, wrong trip and out-of-order pushes', async () => {
  const handlers = {};
  const receipts = new Map();
  const shown = [];
  let activeCode = 'B';
  class Channel {
    constructor() {
      this.port1 = { close() {}, onmessage: null };
      this.port2 = { postMessage: (data) => queueMicrotask(() => this.port1.onmessage?.({ data })) };
    }
  }
  const cache = { match: async (key) => receipts.get(key)?.clone(), put: async (key, value) => receipts.set(key, value), keys: async () => [...receipts.keys()], delete: async (key) => receipts.delete(key) };
  const client = { focused: true, visibilityState: 'visible', postMessage: (message, ports) => { if (ports) ports[0].postMessage({ code: activeCode }); } };
  const sandbox = {
    self: { location: { origin: 'https://example.test' }, addEventListener: (type, fn) => { handlers[type] = fn; }, registration: { showNotification: async (title, options) => shown.push({ title, ...options }) } },
    clients: { matchAll: async () => [client] }, caches: { open: async () => cache }, URL, Response, Promise, MessageChannel: Channel, setTimeout, clearTimeout, console,
  };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf8'), sandbox);
  async function push(payload) { let done; handlers.push({ data: { json: () => payload }, waitUntil: (p) => { done = p; } }); await done; }
  await push({ ...called, title: 'Called A', body: 'A' });
  assert.equal(shown[0].silent, undefined, 'viewing B must not silence A');
  activeCode = 'A';
  await push({ ...called, eventId: 'A:CALLED:3', occurredAt: '2026-10-27T03:00:00.000Z', title: 'Called again', body: 'A' });
  assert.equal(shown[1].silent, true, 'matching foreground owns app audio');
  await push({ ...called, status: 'WAITING', eventId: 'A:WAITING:1', occurredAt: trip.lastEventAt, title: 'Late check-in' });
  assert.equal(shown[2].title, 'Called again');
  assert.equal(shown[2].silent, true);
});
