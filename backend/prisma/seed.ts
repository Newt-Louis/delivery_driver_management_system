import { GoodsType, Prisma, PrismaClient, Role, VehicleType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const NORMAL_GOODS: GoodsType[] = [
  GoodsType.FRESH_FOOD,
  GoodsType.GENERAL_GOODS,
  GoodsType.THI_CONG,
];

const UNIT_DEFINITIONS = [
  {
    unit: 'THISKYHALL',
    displayName: 'Thiskyhall',
    shortName: 'Thiskyhall',
    description: 'Khu nhận hàng Thiskyhall',
    zoneCode: 'KT-1',
    zoneName: 'Khu Thiskyhall 1',
  },
  {
    // TENANT is the existing runtime code for the business-facing THISO Mall unit.
    unit: 'TENANT',
    displayName: 'THISO Mall',
    shortName: 'THISO Mall',
    description: 'Khu nhận hàng THISO Mall',
    zoneCode: 'KM-1',
    zoneName: 'Khu THISO Mall 1',
  },
  {
    unit: 'EMART',
    displayName: 'Emart',
    shortName: 'Emart',
    description: 'Khu nhận hàng Emart',
    zoneCode: 'KE-1',
    zoneName: 'Khu Emart 1',
  },
] as const;

const SLOT_DEFINITIONS = [
  { unit: 'THISKYHALL', code: 'T1', vehicleType: VehicleType.TRUCK, maxCapacity: 1 },
  { unit: 'THISKYHALL', code: 'T2', vehicleType: VehicleType.TRUCK, maxCapacity: 1 },
  { unit: 'THISKYHALL', code: 'T3', vehicleType: VehicleType.MOTORBIKE, maxCapacity: 5 },
  { unit: 'TENANT', code: 'M1', vehicleType: VehicleType.TRUCK, maxCapacity: 1 },
  { unit: 'TENANT', code: 'M2', vehicleType: VehicleType.TRUCK, maxCapacity: 1 },
  { unit: 'TENANT', code: 'M3', vehicleType: VehicleType.MOTORBIKE, maxCapacity: 5 },
  { unit: 'EMART', code: 'E1', vehicleType: VehicleType.TRUCK, maxCapacity: 5 },
  { unit: 'EMART', code: 'E2', vehicleType: VehicleType.TRUCK, maxCapacity: 5 },
  { unit: 'EMART', code: 'E3', vehicleType: VehicleType.TRUCK, maxCapacity: 5 },
  { unit: 'EMART', code: 'E4', vehicleType: VehicleType.TRUCK, maxCapacity: 5 },
  { unit: 'EMART', code: 'E5', vehicleType: VehicleType.TRUCK, maxCapacity: 5 },
  { unit: 'EMART', code: 'E6', vehicleType: VehicleType.TRUCK, maxCapacity: 5 },
] as const;

const LOCATION_DEFINITIONS = [
  {
    code: 'SAL',
    locationName: 'THISO SALA',
    address: 'THISO SALA, TP. Hồ Chí Minh',
    accountSuffix: 'sal',
  },
  {
    code: 'PVT',
    locationName: 'THISO Phan Văn Trị',
    address: 'THISO Phan Văn Trị, TP. Hồ Chí Minh',
    accountSuffix: 'pvt',
  },
] as const;

/**
 * The historical migration chain creates this single placeholder record on a
 * brand-new database. Bootstrap may replace only this known scaffold; it must
 * never be used to reset a database which contains application data.
 */
async function assertBootstrapEligible() {
  const [
    locations,
    users,
    userUnitPermissions,
    faceCredentials,
    authChallenges,
    devices,
    slots,
    zones,
    unitConfigs,
    unitGoodsTypes,
    deliveryTimeWindows,
    receivingTimeConfigs,
    autoWarehouseVendors,
    deliveries,
    deliveryHistories,
    deliveryHistoryEvents,
    ticketSequences,
    registrationSequences,
    schedulerJobHistories,
    pushSubscriptions,
    auditLogs,
    uploadedFiles,
  ] = await Promise.all([
    prisma.businessLocation.findMany({ select: { id: true, code: true } }),
    prisma.user.count(),
    prisma.userUnitPermission.count(),
    prisma.faceCredential.count(),
    prisma.authChallenge.count(),
    prisma.device.count(),
    prisma.slot.count(),
    prisma.zone.count(),
    prisma.unitConfig.count(),
    prisma.unitGoodsType.count(),
    prisma.deliveryTimeWindow.count(),
    prisma.receivingTimeConfig.count(),
    prisma.autoWarehouseVendor.count(),
    prisma.deliveryRegistration.count(),
    prisma.deliveryHistory.count(),
    prisma.deliveryHistoryEvent.count(),
    prisma.ticketSequence.count(),
    prisma.registrationSequence.count(),
    prisma.schedulerJobHistory.count(),
    prisma.pushSubscription.count(),
    prisma.auditLog.count(),
    prisma.uploadedFile.count(),
  ]);

  const locationIsEmpty = locations.length === 0;
  const locationIsMigrationScaffold = locations.length === 1
    && locations[0].id === 'singleton'
    && locations[0].code === 'DEFAULT';

  const existingData = [
    ['User', users],
    ['UserUnitPermission', userUnitPermissions],
    ['FaceCredential', faceCredentials],
    ['AuthChallenge', authChallenges],
    ['Device', devices],
    ['Slot', slots],
    ['Zone', zones],
    ['UnitConfig', unitConfigs],
    ['UnitGoodsType', unitGoodsTypes],
    ['DeliveryTimeWindow', deliveryTimeWindows],
    ['ReceivingTimeConfig', receivingTimeConfigs],
    ['AutoWarehouseVendor', autoWarehouseVendors],
    ['DeliveryRegistration', deliveries],
    ['DeliveryHistory', deliveryHistories],
    ['DeliveryHistoryEvent', deliveryHistoryEvents],
    ['TicketSequence', ticketSequences],
    ['RegistrationSequence', registrationSequences],
    ['SchedulerJobHistory', schedulerJobHistories],
    ['PushSubscription', pushSubscriptions],
    ['AuditLog', auditLogs],
    ['UploadedFile', uploadedFiles],
  ].filter(([, count]) => count > 0);

  if ((!locationIsEmpty && !locationIsMigrationScaffold) || existingData.length > 0) {
    const locationDescription = locations.length === 0
      ? 'không có'
      : locations.map((location) => `${location.code} (${location.id})`).join(', ');
    const dataDescription = existingData.length > 0
      ? existingData.map(([model, count]) => `${model}=${count}`).join(', ')
      : 'không có';

    throw new Error(
      'Refusing to bootstrap because this database is not new. '
      + `BusinessLocation: ${locationDescription}. Existing records: ${dataDescription}. `
      + 'db:bootstrap only initializes an empty database and never resets existing data.',
    );
  }

  return locationIsMigrationScaffold;
}

async function removeMigrationScaffold(db: Prisma.TransactionClient, hasMigrationScaffold: boolean) {
  if (hasMigrationScaffold) {
    await db.businessLocation.delete({ where: { id: 'singleton' } });
  }
}

async function seedLocation(
  db: Prisma.TransactionClient,
  definition: typeof LOCATION_DEFINITIONS[number],
  passwordHash: string,
) {
  const location = await db.businessLocation.create({
    data: {
      code: definition.code,
      locationName: definition.locationName,
      address: definition.address,
      tagline: 'Hệ thống điều phối giao nhận hàng',
    },
  });

  const unitConfigs = await Promise.all(UNIT_DEFINITIONS.map((unit) => db.unitConfig.create({
    data: {
      businessLocationId: location.id,
      unit: unit.unit,
      freshFoodEnabled: true,
      generalGoodsEnabled: true,
      thiCongEnabled: true,
      displayName: unit.displayName,
      shortName: unit.shortName,
      description: unit.description,
    },
  })));
  const unitByCode = new Map(unitConfigs.map((unit) => [unit.unit, unit]));

  const zones = await Promise.all(UNIT_DEFINITIONS.map((unit) => db.zone.create({
    data: {
      code: unit.zoneCode,
      name: unit.zoneName,
      unitConfigId: unitByCode.get(unit.unit)!.id,
    },
  })));
  const zoneByUnit = new Map(zones.map((zone) => [unitConfigs.find((unit) => unit.id === zone.unitConfigId)!.unit, zone]));

  await db.slot.createMany({
    data: SLOT_DEFINITIONS.map((slot) => ({
      code: slot.code,
      name: `Vị trí ${slot.code}`,
      assignedUnit: slot.unit,
      vehicleType: slot.vehicleType,
      maxCapacity: slot.maxCapacity,
      acceptedGoods: NORMAL_GOODS,
      goodsPriority: NORMAL_GOODS,
      zoneId: zoneByUnit.get(slot.unit)!.id,
    })),
  });

  await db.unitGoodsType.createMany({
    data: unitConfigs.flatMap((unit) => [
      { unit: unit.unit, unitConfigId: unit.id, name: 'Hàng tươi sống', emoji: '🥬', baseType: GoodsType.FRESH_FOOD, sortOrder: 1 },
      { unit: unit.unit, unitConfigId: unit.id, name: 'Hàng tổng hợp', emoji: '📦', baseType: GoodsType.GENERAL_GOODS, sortOrder: 2 },
      { unit: unit.unit, unitConfigId: unit.id, name: 'Hàng thi công', emoji: '🏗️', baseType: GoodsType.THI_CONG, sortOrder: 3 },
    ]),
  });

  const users = await Promise.all([
    db.user.create({ data: { name: `Admin khu vực ${definition.code}`, email: `adminloc.${definition.accountSuffix}@mall.com`, passwordHash, role: Role.ADMIN_LOC, businessLocationId: location.id } }),
    db.user.create({ data: { name: `Admin vận hành ${definition.code}`, email: `adminope.${definition.accountSuffix}@mall.com`, passwordHash, role: Role.ADMIN_OPE, businessLocationId: location.id } }),
    db.user.create({ data: { name: `Nhận hàng ${definition.code}`, email: `receiving.${definition.accountSuffix}@mall.com`, passwordHash, role: Role.RECEIVING, businessLocationId: location.id } }),
    db.user.create({ data: { name: `Check-in ${definition.code}`, email: `checkin.${definition.accountSuffix}@mall.com`, passwordHash, role: Role.CHECKIN, businessLocationId: location.id } }),
  ]);

  await db.userUnitPermission.createMany({
    data: users.flatMap((user) => unitConfigs.map((unit) => ({ userId: user.id, unitConfigId: unit.id }))),
  });

  console.log(`✅ ${definition.code}: 3 unit, 3 zone, 12 slot, 4 tài khoản nghiệp vụ`);
}

async function main() {
  const hasMigrationScaffold = await assertBootstrapEligible();

  const [superadminPasswordHash, locationPasswordHash] = await Promise.all([
    bcrypt.hash('password123', 10),
    bcrypt.hash('Thiso@123456', 10),
  ]);

  await prisma.$transaction(async (tx) => {
    await removeMigrationScaffold(tx, hasMigrationScaffold);

    await tx.user.create({
      data: {
        name: 'Super Admin',
        email: 'superadmin@mall.com',
        passwordHash: superadminPasswordHash,
        role: Role.SUPERADMIN,
      },
    });

    for (const location of LOCATION_DEFINITIONS) {
      await seedLocation(tx, location, locationPasswordHash);
    }
  }, { timeout: 30_000 });

  console.log('\n✅ Database bootstrap completed.');
  console.log('   Superadmin: superadmin@mall.com / password123');
  for (const location of LOCATION_DEFINITIONS) {
    console.log(`   ${location.code}: adminloc.${location.accountSuffix}@mall.com, adminope.${location.accountSuffix}@mall.com, receiving.${location.accountSuffix}@mall.com, checkin.${location.accountSuffix}@mall.com / Thiso@123456`);
  }
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
