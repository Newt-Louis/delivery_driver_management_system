const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const MODE = process.argv[2] || 'same-slot';
const COUNT = Number(process.env.COUNT || process.argv[3] || 50);
const KEEP = process.env.KEEP === '1';

function pad(n, width = 3) {
  return String(n).padStart(width, '0');
}

function localDateTimeAfterDays(days, hour, minute) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1, 2);
  const dd = pad(date.getDate(), 2);
  const hh = pad(date.getHours(), 2);
  const mi = pad(date.getMinutes(), 2);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:00`;
}

function buildPayloads(note) {
  if (MODE === 'same-plate') {
    const vehiclePlate = `${note}PLATE`.slice(0, 24);
    return Array.from({ length: COUNT }, () => ({
      vendorName: 'Race Test Vendor',
      driverName: 'Race Test Driver',
      driverPhone: '0900000000',
      vehiclePlate,
      vehicleType: 'TRUCK',
      receivingUnit: 'EMART',
      goodsType: 'GENERAL_GOODS',
      note,
    }));
  }

  if (MODE === 'same-slot') {
    const requestedTime = process.env.REQUESTED_TIME || localDateTimeAfterDays(30, 3, 17);
    return Array.from({ length: COUNT }, (_, i) => ({
      vendorName: 'Race Slot Vendor',
      driverName: `Race Driver ${i}`,
      driverPhone: `091${pad(i, 7)}`,
      vehiclePlate: `${note}${pad(i)}`.slice(0, 24),
      vehicleType: 'TRUCK',
      receivingUnit: 'EMART',
      goodsType: 'GENERAL_GOODS',
      requestedTime,
      note,
    }));
  }

  throw new Error(`Unknown mode "${MODE}". Use same-plate or same-slot.`);
}

async function postRegister(payload) {
  const res = await fetch(`${API_BASE}/api/deliveries/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = await res.text();
  }
  return { status: res.status, body };
}

function summarize(results) {
  const byStatus = new Map();
  const byError = new Map();
  for (const result of results) {
    byStatus.set(result.status, (byStatus.get(result.status) || 0) + 1);
    const key = result.body?.error || 'OK';
    byError.set(key, (byError.get(key) || 0) + 1);
  }
  return {
    byStatus: Object.fromEntries([...byStatus.entries()].sort(([a], [b]) => a - b)),
    byError: Object.fromEntries([...byError.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))),
    successCodes: results
      .filter((r) => r.status === 201)
      .map((r) => r.body?.registrationCode)
      .filter(Boolean),
    sampleErrors: results
      .filter((r) => r.status !== 201)
      .slice(0, 3)
      .map((r) => r.body),
  };
}

async function cleanup(note) {
  const deliveries = await prisma.deliveryRegistration.findMany({
    where: { note },
    select: { id: true, registrationCode: true },
  });
  const ids = deliveries.map((d) => d.id);
  const codes = deliveries.map((d) => d.registrationCode);
  if (ids.length === 0) return 0;

  await prisma.$transaction([
    prisma.auditLog.deleteMany({ where: { targetId: { in: ids } } }),
    prisma.callLog.deleteMany({ where: { deliveryRegistrationId: { in: ids } } }),
    prisma.pushSubscription.deleteMany({ where: { deliveryCode: { in: codes } } }),
    prisma.deliveryRegistration.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return ids.length;
}

async function main() {
  if (!Number.isInteger(COUNT) || COUNT <= 0) throw new Error('COUNT must be a positive integer.');

  const note = `RACE${Date.now().toString(36).toUpperCase()}`;
  const payloads = buildPayloads(note);

  console.log(`[register-race] mode=${MODE} count=${COUNT} api=${API_BASE}`);
  if (MODE === 'same-slot') console.log(`[register-race] requestedTime=${payloads[0].requestedTime}`);
  console.log('[register-race] firing requests...');

  const startedAt = Date.now();
  const results = await Promise.all(payloads.map(postRegister));
  const elapsedMs = Date.now() - startedAt;
  const summary = summarize(results);

  console.log(JSON.stringify({ elapsedMs, note, ...summary }, null, 2));

  if (KEEP) {
    console.log(`[register-race] KEEP=1, kept test records with note=${note}`);
  } else {
    const deleted = await cleanup(note);
    console.log(`[register-race] cleaned ${deleted} test records`);
  }
}

main()
  .catch((error) => {
    console.error('[register-race] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
