import {
  PrismaClient, Role, ReceivingUnit, GoodsType,
  DeliveryStatus, VehicleType, DeviceType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Ticket code helper ───────────────────────────────────────────────────────
const UNIT_TICKET_PREFIX: Record<string, string> = {
  EMART: 'EMART', THISKYHALL: 'THISKY', TENANT: 'MALL',
};
const VT_TICKET_PREFIX: Record<string, string> = { TRUCK: 'T', MOTORBIKE: 'M' };

function tc(unit: ReceivingUnit, vt: VehicleType, n: number): string {
  return `${UNIT_TICKET_PREFIX[unit]}-${VT_TICKET_PREFIX[vt]}${String(n).padStart(3, '0')}`;
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
const NOW = new Date();
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

function todayAt(h: number, m = 0): Date {
  return new Date(TODAY.getTime() + h * 3600_000 + m * 60_000);
}
function daysAgo(d: number, h = 9, m = 0): Date {
  return new Date(TODAY.getTime() - d * 86400_000 + h * 3600_000 + m * 60_000);
}
function hoursFromNow(h: number): Date {
  return new Date(NOW.getTime() + h * 3600_000);
}

// ─── Name pools ───────────────────────────────────────────────────────────────
const VENDORS = [
  'Thực Phẩm Tươi Sống ABC', 'Nông Sản Xanh Việt Nam', 'Hải Sản Sạch Sài Gòn',
  'Điện Máy Hoàng Gia', 'Kho Lạnh Phương Nam', 'Logistics Đại Dương',
  'Hàng Tiêu Dùng Phúc Lộc', 'Phân Phối Á Châu', 'Thương Mại Thịnh Vượng',
  'Chuỗi Cung Ứng Xanh', 'Công ty Đồng Tiến', 'Tập Đoàn Phú Quý',
  'HTX Bắc Sơn', 'Vận Chuyển Hải Long', 'Nhập Khẩu Bình Minh',
];
const DRIVERS = [
  'Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Cường', 'Phạm Quốc Dũng',
  'Hoàng Văn Em', 'Vũ Thị Phương', 'Đặng Văn Giang', 'Bùi Thị Hương',
  'Ngô Minh Khôi', 'Đinh Thị Lan', 'Tô Văn Minh', 'Dương Thị Ngân',
  'Chu Văn Ô', 'Hồ Thị Phụng', 'Đỗ Văn Quân',
];

let _seq = 0;
function nextVendor() { return VENDORS[_seq % VENDORS.length]; }
function nextDriver() { return DRIVERS[_seq % DRIVERS.length]; }
function nextPhone() { _seq++; return `09${String(10000000 + (_seq * 7919) % 89999999)}`; }

// ─── Plate generator ──────────────────────────────────────────────────────────
const plateCounters: Record<string, number> = {};
function plate(region: string, letter: string): string {
  const key = `${region}${letter}`;
  plateCounters[key] = (plateCounters[key] ?? 0) + 1;
  const n = plateCounters[key];
  return `${region}${letter}-${String(n).padStart(3, '0')}.${String(n % 99 + 1).padStart(2, '0')}`;
}

// ─── Registration code generator ─────────────────────────────────────────────
let regCounter = 1;
function regCode(prefix: string) {
  const ymd = TODAY.toISOString().slice(2, 10).replace(/-/g, '');
  return `${prefix}${ymd}${String(regCounter++).padStart(3, '0')}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🗑  Clearing all data...');
  await prisma.pushSubscription.deleteMany();
  await prisma.callLog.deleteMany();
  await prisma.deliveryRegistration.deleteMany();
  await prisma.registrationSequence.deleteMany();
  await prisma.deliveryTimeWindow.deleteMany();
  await prisma.unitGoodsType.deleteMany();
  await prisma.receivingTimeConfig.deleteMany();
  await prisma.staffPin.deleteMany();
  await prisma.device.deleteMany();
  await prisma.slot.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.unitConfig.deleteMany();
  await prisma.user.deleteMany();
  await prisma.businessLocation.deleteMany();
  console.log('   Done.\n');

  // ── Business location ───────────────────────────────────────────────────────
  const defaultLocation = await prisma.businessLocation.create({
    data: {
      id: 'singleton',
      code: 'LOC_1',
      locationName: 'THISO MALL TÂY HỒ TÂY',
      address: 'Khu đô thị Tây Hồ Tây, Hà Nội',
      tagline: 'Hệ Thống Điều Phối Giao – Nhận Hàng Thông Minh',
    },
  });
  console.log('✅ Business location created');

  // ── Users ───────────────────────────────────────────────────────────────────
  const pw = await bcrypt.hash('password123', 10);
  await prisma.user.createMany({
    data: [
      { name: 'Super Admin', email: 'superadmin@mall.com', passwordHash: pw, role: Role.SUPERADMIN },
      { name: 'Admin Location', email: 'admin@mall.com', passwordHash: pw, role: Role.ADMIN_LOC, businessLocationId: defaultLocation.id },
      { name: 'Admin Vận hành', email: 'operator@mall.com', passwordHash: pw, role: Role.ADMIN_OPE, unit: ReceivingUnit.EMART, businessLocationId: defaultLocation.id },
      { name: 'Nhân viên nhận', email: 'receiving@mall.com', passwordHash: pw, role: Role.RECEIVING, unit: ReceivingUnit.EMART, businessLocationId: defaultLocation.id },
      { name: 'Nhân viên check-in', email: 'checkin@mall.com', passwordHash: pw, role: Role.CHECKIN, unit: ReceivingUnit.EMART, businessLocationId: defaultLocation.id },
    ],
  });
  console.log('✅ Users created  (password: password123)');

  // Staff PINs are intentionally left empty. The current production flow uses
  // real user accounts/JWT for check-in and receiving actions.
  console.log('ℹ️  Staff PINs skipped (reserved for future flows)');

  // ── Devices ────────────────────────────────────────────────────────────────
  const deviceSecretHash = await bcrypt.hash('device123', 10);
  await prisma.device.createMany({
    data: [
      {
        code: 'FIXED-LOC1',
        name: 'Thiết bị cố định LOC_1',
        businessLocationId: defaultLocation.id,
        deviceType: DeviceType.FIXED_DEVICE,
        deviceSecretHash,
      },
      {
        code: 'PDA-LOC1',
        name: 'PDA nhận hàng LOC_1',
        businessLocationId: defaultLocation.id,
        deviceType: DeviceType.PDA,
        deviceSecretHash,
      },
    ],
  });
  console.log('✅ Devices created (FIXED-LOC1/PDA-LOC1, secret: device123)');

  // ── Unit configs ─────────────────────────────────────────────────────────────
  const unitConfigs = await Promise.all([
    prisma.unitConfig.create({
      data: {
        businessLocationId: defaultLocation.id,
        unit: ReceivingUnit.EMART,
        freshFoodEnabled: true,
        generalGoodsEnabled: true,
        thiCongEnabled: false,
        sundayFreshFoodOnly: true,
        truckSlotMinutes: 30, motorbikeSlotMinutes: 15, truckMaxPerSlot: 1, motorbikeMaxPerSlot: 3,
        displayName: 'Emart', shortName: 'Emart', description: 'Siêu thị Emart', primaryColor: '#FF9500',
      },
    }),
    prisma.unitConfig.create({
      data: {
        businessLocationId: defaultLocation.id,
        unit: ReceivingUnit.THISKYHALL,
        freshFoodEnabled: true,
        generalGoodsEnabled: true,
        thiCongEnabled: true,
        sundayFreshFoodOnly: false,
        truckSlotMinutes: 30, motorbikeSlotMinutes: 15, truckMaxPerSlot: 1, motorbikeMaxPerSlot: 3,
        displayName: 'Thiskyhall', shortName: 'Skyhall', description: 'Trung tâm thương mại', primaryColor: '#27A55E',
      },
    }),
    prisma.unitConfig.create({
      data: {
        businessLocationId: defaultLocation.id,
        unit: ReceivingUnit.TENANT,
        freshFoodEnabled: false,
        generalGoodsEnabled: true,
        thiCongEnabled: true,

        sundayFreshFoodOnly: false,
        truckSlotMinutes: 30, motorbikeSlotMinutes: 15, truckMaxPerSlot: 1, motorbikeMaxPerSlot: 3,
        displayName: 'Mall (Khách thuê)', shortName: 'Mall', description: 'Khu vực khách thuê', primaryColor: '#4F46E5',
      },
    }),
  ]);
  const UC = Object.fromEntries(unitConfigs.map((cfg) => [cfg.unit, cfg]));
  console.log('✅ Unit configs created');

  // ── Zones ────────────────────────────────────────────────────────────────────
  const [k1, k2, k3, k4t, k4e, k5] = await Promise.all([
    prisma.zone.create({ data: { code: 'K1', name: 'Khu 1 – Trái Trên (Thiskyhall)', unitConfigId: UC.THISKYHALL.id } }),
    prisma.zone.create({ data: { code: 'K2', name: 'Khu 2 – Phải Trên (Tenant)', unitConfigId: UC.TENANT.id } }),
    prisma.zone.create({ data: { code: 'K3', name: 'Khu 3 – Trái Dưới (Emart)', unitConfigId: UC.EMART.id } }),
    prisma.zone.create({ data: { code: 'K4', name: 'Khu 4 – Trung Tâm (Thiskyhall)', unitConfigId: UC.THISKYHALL.id } }),
    prisma.zone.create({ data: { code: 'K4', name: 'Khu 4 – Trung Tâm (Emart)', unitConfigId: UC.EMART.id } }),
    prisma.zone.create({ data: { code: 'K5', name: 'Khu 5 – Dưới (Gần vòng xuyến ra)', unitConfigId: UC.TENANT.id } }),
  ]);
  console.log('✅ Zones created');

  // ── Slots ────────────────────────────────────────────────────────────────────
  const slotData = [
    // THISKYHALL trucks (3)
    { code: 'T1', name: 'Vị trí Tải 1 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.TRUCK, zoneId: k1.id, acceptedGoods: [], autoAssign: true, maxCapacity: 1 },
    { code: 'T2', name: 'Vị trí Tải 2 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.TRUCK, zoneId: k1.id, acceptedGoods: [], autoAssign: true, maxCapacity: 1 },
    { code: 'T3', name: 'Vị trí Tải 3 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.TRUCK, zoneId: k1.id, acceptedGoods: [], autoAssign: true, maxCapacity: 1 },
    // TENANT trucks (2)
    { code: 'T4', name: 'Vị trí Tải 4 – Mall/Tenant', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.TRUCK, zoneId: k2.id, acceptedGoods: [GoodsType.GENERAL_GOODS], autoAssign: true, maxCapacity: 1 },
    { code: 'T5', name: 'Vị trí Tải 5 – Mall/Tenant', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.TRUCK, zoneId: k2.id, acceptedGoods: [], autoAssign: true, maxCapacity: 1 },
    // EMART trucks (4)
    { code: 'T6', name: 'Vị trí Tải 6 – Emart Hàng Tươi', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.TRUCK, zoneId: k3.id, acceptedGoods: [GoodsType.FRESH_FOOD], autoAssign: true, maxCapacity: 1 },
    { code: 'T7', name: 'Vị trí Tải 7 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.TRUCK, zoneId: k3.id, acceptedGoods: [GoodsType.FRESH_FOOD, GoodsType.GENERAL_GOODS], autoAssign: true, maxCapacity: 1 },
    { code: 'T8', name: 'Vị trí Tải 8 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.TRUCK, zoneId: k3.id, acceptedGoods: [], autoAssign: true, maxCapacity: 1 },
    { code: 'T9', name: 'Vị trí Tải 9 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.TRUCK, zoneId: k3.id, acceptedGoods: [], autoAssign: true, maxCapacity: 1 },
    // THISKYHALL motorbikes (5)
    { code: 'M1', name: 'Vị trí Xe Máy 1 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.MOTORBIKE, zoneId: k1.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M2', name: 'Vị trí Xe Máy 2 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.MOTORBIKE, zoneId: k1.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M3', name: 'Vị trí Xe Máy 3 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.MOTORBIKE, zoneId: k1.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M4', name: 'Vị trí Xe Máy 4 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.MOTORBIKE, zoneId: k4t.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M5', name: 'Vị trí Xe Máy 5 – Thiskyhall', assignedUnit: ReceivingUnit.THISKYHALL, vehicleType: VehicleType.MOTORBIKE, zoneId: k4t.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    // TENANT motorbikes (5)
    { code: 'M6', name: 'Vị trí Xe Máy 6 – Mall', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.MOTORBIKE, zoneId: k2.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M7', name: 'Vị trí Xe Máy 7 – Mall', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.MOTORBIKE, zoneId: k2.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M8', name: 'Vị trí Xe Máy 8 – Mall', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.MOTORBIKE, zoneId: k5.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M9', name: 'Vị trí Xe Máy 9 – Mall', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.MOTORBIKE, zoneId: k5.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M10', name: 'Vị trí Xe Máy 10 – Mall', assignedUnit: ReceivingUnit.TENANT, vehicleType: VehicleType.MOTORBIKE, zoneId: k5.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    // EMART motorbikes (5)
    { code: 'M11', name: 'Vị trí Xe Máy 11 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.MOTORBIKE, zoneId: k3.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M12', name: 'Vị trí Xe Máy 12 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.MOTORBIKE, zoneId: k3.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M13', name: 'Vị trí Xe Máy 13 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.MOTORBIKE, zoneId: k3.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M14', name: 'Vị trí Xe Máy 14 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.MOTORBIKE, zoneId: k4e.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
    { code: 'M15', name: 'Vị trí Xe Máy 15 – Emart', assignedUnit: ReceivingUnit.EMART, vehicleType: VehicleType.MOTORBIKE, zoneId: k4e.id, acceptedGoods: [], autoAssign: true, maxCapacity: 3 },
  ];
  await prisma.slot.createMany({ data: slotData });

  // Fetch created slots by code for assignment
  const slots = await prisma.slot.findMany();
  const S = Object.fromEntries(slots.map((s) => [s.code, s]));
  console.log('✅ Slots created');

  await prisma.deliveryTimeWindow.createMany({
    data: [
      { unit: ReceivingUnit.EMART, goodsType: GoodsType.FRESH_FOOD, startTime: '04:00', endTime: '19:00', label: 'Fresh food', sortOrder: 1 },
      { unit: ReceivingUnit.EMART, goodsType: GoodsType.GENERAL_GOODS, startTime: '06:00', endTime: '20:00', label: 'General goods', sortOrder: 2 },
      { unit: ReceivingUnit.THISKYHALL, goodsType: GoodsType.FRESH_FOOD, startTime: '04:00', endTime: '19:00', label: 'Fresh food', sortOrder: 1 },
      { unit: ReceivingUnit.THISKYHALL, goodsType: GoodsType.GENERAL_GOODS, startTime: '07:00', endTime: '20:00', label: 'General goods', sortOrder: 2 },
      { unit: ReceivingUnit.THISKYHALL, goodsType: GoodsType.THI_CONG, startTime: '07:00', endTime: '18:00', label: 'Construction', sortOrder: 3 },
      { unit: ReceivingUnit.TENANT, goodsType: GoodsType.GENERAL_GOODS, startTime: '07:00', endTime: '20:00', label: 'General goods', sortOrder: 1 },
      { unit: ReceivingUnit.TENANT, goodsType: GoodsType.THI_CONG, startTime: '08:00', endTime: '17:00', label: 'Construction', sortOrder: 2 },
    ],
  });
  console.log('✅ Delivery time windows created');

  // ── Sample deliveries ─────────────────────────────────────────────────────────
  //
  // Scenario: busy mid-morning at the mall (10:30 AM)
  //
  // Each unit × vehicle type block:
  //   • 3 COMPLETED  (past days, dashboard history)
  //   • 2 COMPLETED  (today early morning, dashboard today)
  //   • 2 RECEIVING  (in slot right now)
  //   • 2 CALLED     (heading to slot)
  //   • 5 WAITING    (in queue with ticket number)
  //   • 4 REGISTERED (upcoming this afternoon)
  //   ──────────────────────
  //   18 per block × 6 blocks = 108 total

  type DInput = Parameters<typeof prisma.deliveryRegistration.create>[0]['data'];
  const deliveries: DInput[] = [];

  // Block generator
  function makeBlock(
    unit: ReceivingUnit,
    vt: VehicleType,
    region: string,
    letter: string,
    codePrefix: string,
    goodsPool: GoodsType[],
    receivingSlotCodes: string[],
    calledSlotCodes: string[],
  ) {
    let ticketSeq = 0; // ticket counter for this block

    function makeD(opts: {
      status: DeliveryStatus;
      goods: GoodsType;
      checkinTime?: Date;
      requestedTime?: Date;
      completedTime?: Date;
      assignedSlotCode?: string;
      calledTime?: Date;
      receivingStartTime?: Date;
      note?: string;
    }): DInput {
      const ticketStatuses: DeliveryStatus[] = [
        DeliveryStatus.WAITING, DeliveryStatus.CALLED,
        DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING,
      ];
      const hasTicket = ticketStatuses.includes(opts.status) ||
        (opts.status === DeliveryStatus.COMPLETED && opts.checkinTime &&
          opts.checkinTime >= TODAY);

      if (hasTicket) ticketSeq++;

      return {
        registrationCode: regCode(codePrefix),
        vendorName: nextVendor(),
        driverName: nextDriver(),
        driverPhone: nextPhone(),
        vehiclePlate: plate(region, letter),
        vehicleType: vt,
        receivingUnit: unit,
        goodsType: opts.goods,
        poNumber: `PO-${codePrefix}-${String(regCounter).padStart(4, '0')}`,
        status: opts.status,
        autoWarehouse: opts.goods === GoodsType.AUTO_WAREHOUSE,
        checkinTime: opts.checkinTime ?? null,
        requestedTime: opts.requestedTime ?? null,
        completedTime: opts.completedTime ?? null,
        calledTime: opts.calledTime ?? null,
        receivingStartTime: opts.receivingStartTime ?? null,
        assignedSlotId: opts.assignedSlotCode ? S[opts.assignedSlotCode]?.id ?? null : null,
        ticketNumber: hasTicket ? ticketSeq : null,
        note: opts.note ?? null,
      };
    }

    // receiving duration by vehicle type (used for realistic seed timestamps)
    const recvMin = vt === VehicleType.TRUCK ? 28 : 14;

    // 3 COMPLETED – past days (no ticket, old records)
    deliveries.push(makeD({ status: DeliveryStatus.COMPLETED, goods: goodsPool[0], checkinTime: daysAgo(3, 8), requestedTime: daysAgo(3, 7, 30), receivingStartTime: new Date(daysAgo(3, 9, 30).getTime() - recvMin * 60_000), completedTime: daysAgo(3, 9, 30) }));
    deliveries.push(makeD({ status: DeliveryStatus.COMPLETED, goods: goodsPool[1], checkinTime: daysAgo(2, 9), requestedTime: daysAgo(2, 8, 30), receivingStartTime: new Date(daysAgo(2, 10, 0).getTime() - recvMin * 60_000), completedTime: daysAgo(2, 10, 0) }));
    deliveries.push(makeD({ status: DeliveryStatus.COMPLETED, goods: goodsPool[2], checkinTime: daysAgo(1, 7, 30), requestedTime: daysAgo(1, 7), receivingStartTime: new Date(daysAgo(1, 8, 45).getTime() - recvMin * 60_000), completedTime: daysAgo(1, 8, 45) }));

    // 2 COMPLETED – today early (with ticket)
    deliveries.push(makeD({ status: DeliveryStatus.COMPLETED, goods: goodsPool[0], checkinTime: todayAt(7, 10), requestedTime: todayAt(7), receivingStartTime: new Date(todayAt(7, 55).getTime() - recvMin * 60_000), completedTime: todayAt(7, 55) }));
    deliveries.push(makeD({ status: DeliveryStatus.COMPLETED, goods: goodsPool[1], checkinTime: todayAt(8, 5), requestedTime: todayAt(8), receivingStartTime: new Date(todayAt(8, 50).getTime() - recvMin * 60_000), completedTime: todayAt(8, 50) }));

    // 2 RECEIVING – currently in slot
    deliveries.push(makeD({ status: DeliveryStatus.RECEIVING, goods: goodsPool[0], checkinTime: todayAt(9, 0), requestedTime: todayAt(9), calledTime: todayAt(9, 15), receivingStartTime: todayAt(9, 30), assignedSlotCode: receivingSlotCodes[0] }));
    deliveries.push(makeD({ status: DeliveryStatus.RECEIVING, goods: goodsPool[2], checkinTime: todayAt(9, 20), requestedTime: todayAt(9, 30), calledTime: todayAt(9, 40), receivingStartTime: todayAt(9, 55), assignedSlotCode: receivingSlotCodes[1] ?? receivingSlotCodes[0] }));

    // 2 CALLED – heading to slot now
    deliveries.push(makeD({ status: DeliveryStatus.CALLED, goods: goodsPool[0], checkinTime: todayAt(9, 45), requestedTime: todayAt(10), calledTime: todayAt(10, 5), assignedSlotCode: calledSlotCodes[0] }));
    deliveries.push(makeD({ status: DeliveryStatus.CALLED, goods: goodsPool[1], checkinTime: todayAt(10, 0), requestedTime: todayAt(10), calledTime: todayAt(10, 10), assignedSlotCode: calledSlotCodes[1] ?? calledSlotCodes[0] }));

    // 5 WAITING – in queue (checked in 10–50 min ago)
    for (let i = 0; i < 5; i++) {
      const minsAgo = 50 - i * 10;
      deliveries.push(makeD({ status: DeliveryStatus.WAITING, goods: goodsPool[i % goodsPool.length], checkinTime: new Date(NOW.getTime() - minsAgo * 60_000), requestedTime: new Date(NOW.getTime() - (minsAgo + 20) * 60_000) }));
    }

    // 4 REGISTERED – upcoming this afternoon
    for (let i = 0; i < 4; i++) {
      deliveries.push(makeD({ status: DeliveryStatus.REGISTERED, goods: goodsPool[i % goodsPool.length], requestedTime: hoursFromNow(1 + i * 1.5) }));
    }
  }

  // ── EMART ──────────────────────────────────────────────────────────────────
  makeBlock(ReceivingUnit.EMART, VehicleType.TRUCK, '51', 'A', 'EA',
    [GoodsType.FRESH_FOOD, GoodsType.GENERAL_GOODS, GoodsType.AUTO_WAREHOUSE],
    ['T8', 'T9'], ['T6', 'T7'],
  );
  makeBlock(ReceivingUnit.EMART, VehicleType.MOTORBIKE, '51', 'B', 'EB',
    [GoodsType.GENERAL_GOODS, GoodsType.FRESH_FOOD, GoodsType.AUTO_WAREHOUSE],
    ['M11', 'M12'], ['M13', 'M14'],
  );

  // ── THISKYHALL ─────────────────────────────────────────────────────────────
  makeBlock(ReceivingUnit.THISKYHALL, VehicleType.TRUCK, '30', 'A', 'TA',
    [GoodsType.GENERAL_GOODS, GoodsType.FRESH_FOOD, GoodsType.AUTO_WAREHOUSE],
    ['T1', 'T2'], ['T2', 'T3'],
  );
  makeBlock(ReceivingUnit.THISKYHALL, VehicleType.MOTORBIKE, '30', 'B', 'TB',
    [GoodsType.GENERAL_GOODS, GoodsType.AUTO_WAREHOUSE, GoodsType.FRESH_FOOD],
    ['M1', 'M2'], ['M3', 'M4'],
  );

  // ── TENANT ─────────────────────────────────────────────────────────────────
  makeBlock(ReceivingUnit.TENANT, VehicleType.TRUCK, '43', 'A', 'NA',
    [GoodsType.GENERAL_GOODS, GoodsType.THI_CONG, GoodsType.AUTO_WAREHOUSE],
    ['T4', 'T5'], ['T4', 'T5'],
  );
  makeBlock(ReceivingUnit.TENANT, VehicleType.MOTORBIKE, '43', 'B', 'NB',
    [GoodsType.GENERAL_GOODS, GoodsType.AUTO_WAREHOUSE, GoodsType.THI_CONG],
    ['M6', 'M7'], ['M8', 'M9'],
  );

  // Insert all deliveries
  for (let b = 0; b < deliveries.length; b += 50) {
    await prisma.deliveryRegistration.createMany({ data: deliveries.slice(b, b + 50) });
  }
  console.log(`✅ Deliveries created: ${deliveries.length} total`);

  // ── Update slot statuses to match assigned deliveries ─────────────────────
  const activeDels = await prisma.deliveryRegistration.findMany({
    where: {
      assignedSlotId: { not: null },
      status: { in: [DeliveryStatus.CALLED, DeliveryStatus.RECEIVING, DeliveryStatus.AUTO_WAREHOUSE_RECEIVING] },
    },
    select: { assignedSlotId: true, id: true },
  });

  const slotOccupancy: Record<string, string[]> = {};
  for (const d of activeDels) {
    if (!d.assignedSlotId) continue;
    if (!slotOccupancy[d.assignedSlotId]) slotOccupancy[d.assignedSlotId] = [];
    slotOccupancy[d.assignedSlotId].push(d.id);
  }

  for (const [slotId, dIds] of Object.entries(slotOccupancy)) {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) continue;
    const isFull = dIds.length >= slot.maxCapacity;
    await prisma.slot.update({
      where: { id: slotId },
      data: {
        status: isFull ? 'OCCUPIED' : 'AVAILABLE',
        currentDeliveryId: dIds[dIds.length - 1],
        lastUsedAt: new Date(),
      },
    });
  }
  console.log('✅ Slot statuses updated');

  // ── Summary ────────────────────────────────────────────────────────────────
  const counts = await prisma.deliveryRegistration.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('\n📊 Delivery summary:');
  for (const { status, _count } of counts.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`   ${status.padEnd(28)} ${_count.id}`);
  }

  // ─── Receiving time config defaults ──────────────────────────────────────────
  console.log('Seeding ReceivingTimeConfig defaults…');
  const VT_DEFAULTS: Array<{ vt: VehicleType; gt: GoodsType; minutes: number }> = [
    { vt: VehicleType.TRUCK, gt: GoodsType.FRESH_FOOD, minutes: 20 },
    { vt: VehicleType.TRUCK, gt: GoodsType.GENERAL_GOODS, minutes: 30 },
    { vt: VehicleType.TRUCK, gt: GoodsType.AUTO_WAREHOUSE, minutes: 25 },
    { vt: VehicleType.TRUCK, gt: GoodsType.THI_CONG, minutes: 45 },
    { vt: VehicleType.MOTORBIKE, gt: GoodsType.FRESH_FOOD, minutes: 10 },
    { vt: VehicleType.MOTORBIKE, gt: GoodsType.GENERAL_GOODS, minutes: 15 },
    { vt: VehicleType.MOTORBIKE, gt: GoodsType.AUTO_WAREHOUSE, minutes: 12 },
    { vt: VehicleType.MOTORBIKE, gt: GoodsType.THI_CONG, minutes: 20 },
  ];
  for (const unit of Object.values(ReceivingUnit)) {
    for (const { vt, gt, minutes } of VT_DEFAULTS) {
      await prisma.receivingTimeConfig.upsert({
        where: { unit_vehicleType_goodsType: { unit, vehicleType: vt, goodsType: gt } },
        create: { unit, vehicleType: vt, goodsType: gt, configuredMinutes: minutes },
        update: {},
      });
    }
  }

  console.log('\n✅ Seed completed!');
  console.log('─────────────────────────────────────────');
  console.log('  Login:        admin@mall.com / password123');
  console.log('  Bảo vệ PIN:  1111  2222  3333');
  console.log('  Nhận hàng:   4444  5555  6666');
  console.log('─────────────────────────────────────────');
  console.log('  Ticket codes: EMART-T001…  EMART-M001…');
  console.log('                THISKY-T001… THISKY-M001…');
  console.log('                MALL-T001…   MALL-M001…');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
