import { PrismaClient, ReceivingUnit, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const prisma = new PrismaClient();

type SeedMode = 'all' | 'business' | 'unit';

const nullableUrl = z.string().trim().min(1).nullable().optional();
const optionalString = z.string().trim().min(1).optional();

const adminSeedSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8),
  department: z.string().trim().min(1).optional(),
  isActive: z.boolean().optional(),
}).strict();

const unitSeedSchema = z.object({
  businessLocationId: z.string().trim().min(1).optional(),
  unit: z.nativeEnum(ReceivingUnit),
  freshFoodEnabled: z.boolean().optional(),
  generalGoodsEnabled: z.boolean().optional(),
  thiCongEnabled: z.boolean().optional(),
  sundayFreshFoodOnly: z.boolean().optional(),
  truckSlotMinutes: z.number().int().positive().optional(),
  motorbikeSlotMinutes: z.number().int().positive().optional(),
  truckMaxPerSlot: z.number().int().positive().optional(),
  motorbikeMaxPerSlot: z.number().int().positive().optional(),
  vendorApiUrl: nullableUrl,
  vendorApiKey: optionalString,
  poApiUrl: nullableUrl,
  poApiKey: optionalString,
  displayName: optionalString,
  shortName: optionalString,
  description: z.string().trim().optional(),
  logoUrl: nullableUrl,
  primaryColor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
}).strict();

const businessLocationSeedSchema = z.object({
  id: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).max(50),
  locationName: z.string().trim().min(1),
  address: z.string().trim().optional(),
  avatarUrl: nullableUrl,
  logoUrl: nullableUrl,
  tagline: z.string().trim().optional(),
  isActive: z.boolean().optional(),
  admin: adminSeedSchema,
  units: z.array(unitSeedSchema).optional().default([]),
}).strict();

const seedFileSchema = z.object({
  businessLocations: z.array(businessLocationSeedSchema).optional().default([]),
  units: z.array(unitSeedSchema).optional().default([]),
}).strict();

type AdminSeed = z.infer<typeof adminSeedSchema>;
type UnitSeed = z.infer<typeof unitSeedSchema>;
type BusinessLocationSeed = z.infer<typeof businessLocationSeedSchema>;
type SeedFile = z.infer<typeof seedFileSchema>;

class SeedInputError extends Error {}

function printHelp() {
  console.log(`
BusinessLocation/UnitConfig seed

Usage:
  npm run db:seed -- --location:all [--file=prisma/location-seed.json] [--dry-run]
  npm run db:seed -- --location:business [--file=prisma/location-seed.json] [--dry-run]
  npm run db:seed -- --location:unit [--file=prisma/location-seed.json] [--dry-run]

Modes:
  --location:all       Create BusinessLocation + location admin + nested units.
  --location:business  Create only BusinessLocation + location admin.
  --location:unit      Create only top-level units; each unit must have businessLocationId.

Aliases:
  --all, --business, --unit
`);
}

function parseArgs(argv: string[]): { mode?: SeedMode; filePath: string; dryRun: boolean; help: boolean } {
  let mode: SeedMode | undefined;
  let filePath = 'prisma/location-seed.json';
  let help = false;
  const dryRun = argv.includes('--dry-run');

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--location:all' || arg === '--all') mode = 'all';
    if (arg === '--location:business' || arg === '--business' || arg === '--location') mode = 'business';
    if (arg === '--location:unit' || arg === '--unit') mode = 'unit';
    if (arg === '--file') {
      filePath = argv[i + 1] ?? filePath;
      i += 1;
    } else if (arg.startsWith('--file=')) {
      filePath = arg.slice('--file='.length);
    }
  }

  return { mode, filePath, dryRun, help };
}

function readSeedFile(filePath: string): SeedFile {
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new SeedInputError(`Seed file not found: ${absolutePath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  return seedFileSchema.parse(parsed);
}

function ensureUnique(values: string[], label: string) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) throw new SeedInputError(`Duplicate ${label} in seed file: ${value}`);
    seen.add(value);
  }
}

function validateFileUniqueness(seed: SeedFile) {
  ensureUnique(seed.businessLocations.map((item) => item.code), 'BusinessLocation code');
  ensureUnique(seed.businessLocations.map((item) => item.admin.email), 'admin email');

  const locationIds = seed.businessLocations
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id));
  ensureUnique(locationIds, 'BusinessLocation id');

  for (const location of seed.businessLocations) {
    ensureUnique(location.units.map((unit) => unit.unit), `unit for BusinessLocation ${location.code}`);
  }

  const topLevelUnitKeys = seed.units
    .filter((unit) => unit.businessLocationId)
    .map((unit) => `${unit.businessLocationId}:${unit.unit}`);
  ensureUnique(topLevelUnitKeys, 'top-level unit businessLocationId + unit');
}

function locationCreateData(location: BusinessLocationSeed) {
  return {
    ...(location.id ? { id: location.id } : {}),
    code: location.code,
    locationName: location.locationName,
    address: location.address ?? '',
    ...(location.avatarUrl !== undefined ? { avatarUrl: location.avatarUrl } : {}),
    ...(location.logoUrl !== undefined ? { logoUrl: location.logoUrl } : {}),
    ...(location.tagline !== undefined ? { tagline: location.tagline } : {}),
    ...(location.isActive !== undefined ? { isActive: location.isActive } : {}),
  };
}

function userCreateData(admin: AdminSeed, passwordHash: string, businessLocationId: string) {
  return {
    name: admin.name,
    email: admin.email,
    passwordHash,
    role: Role.ADMIN_LOC,
    department: admin.department ?? 'Location Admin',
    businessLocationId,
    ...(admin.isActive !== undefined ? { isActive: admin.isActive } : {}),
  };
}

function unitCreateData(unit: UnitSeed, businessLocationId: string) {
  return {
    businessLocationId,
    unit: unit.unit,
    ...(unit.freshFoodEnabled !== undefined ? { freshFoodEnabled: unit.freshFoodEnabled } : {}),
    ...(unit.generalGoodsEnabled !== undefined ? { generalGoodsEnabled: unit.generalGoodsEnabled } : {}),
    ...(unit.thiCongEnabled !== undefined ? { thiCongEnabled: unit.thiCongEnabled } : {}),
    ...(unit.sundayFreshFoodOnly !== undefined ? { sundayFreshFoodOnly: unit.sundayFreshFoodOnly } : {}),
    ...(unit.truckSlotMinutes !== undefined ? { truckSlotMinutes: unit.truckSlotMinutes } : {}),
    ...(unit.motorbikeSlotMinutes !== undefined ? { motorbikeSlotMinutes: unit.motorbikeSlotMinutes } : {}),
    ...(unit.truckMaxPerSlot !== undefined ? { truckMaxPerSlot: unit.truckMaxPerSlot } : {}),
    ...(unit.motorbikeMaxPerSlot !== undefined ? { motorbikeMaxPerSlot: unit.motorbikeMaxPerSlot } : {}),
    ...(unit.vendorApiUrl !== undefined ? { vendorApiUrl: unit.vendorApiUrl } : {}),
    ...(unit.vendorApiKey !== undefined ? { vendorApiKey: unit.vendorApiKey } : {}),
    ...(unit.poApiUrl !== undefined ? { poApiUrl: unit.poApiUrl } : {}),
    ...(unit.poApiKey !== undefined ? { poApiKey: unit.poApiKey } : {}),
    ...(unit.displayName !== undefined ? { displayName: unit.displayName } : {}),
    ...(unit.shortName !== undefined ? { shortName: unit.shortName } : {}),
    ...(unit.description !== undefined ? { description: unit.description } : {}),
    ...(unit.logoUrl !== undefined ? { logoUrl: unit.logoUrl } : {}),
    ...(unit.primaryColor !== undefined ? { primaryColor: unit.primaryColor } : {}),
  };
}

async function assertBusinessLocationsCanBeCreated(locations: BusinessLocationSeed[]) {
  for (const location of locations) {
    if (location.id) {
      const existingById = await prisma.businessLocation.findUnique({ where: { id: location.id }, select: { id: true } });
      if (existingById) throw new SeedInputError(`BusinessLocation id already exists: ${location.id}`);
    }

    const existingByCode = await prisma.businessLocation.findUnique({ where: { code: location.code }, select: { id: true } });
    if (existingByCode) throw new SeedInputError(`BusinessLocation code already exists: ${location.code}`);

    const existingAdmin = await prisma.user.findUnique({ where: { email: location.admin.email }, select: { id: true } });
    if (existingAdmin) throw new SeedInputError(`Admin email already exists: ${location.admin.email}`);
  }
}

async function assertUnitsCanBeCreated(units: Array<UnitSeed & { businessLocationId: string }>) {
  if (units.length === 0) return;

  const locationIds = [...new Set(units.map((unit) => unit.businessLocationId))];
  const locations = await prisma.businessLocation.findMany({
    where: { id: { in: locationIds } },
    select: { id: true },
  });
  const foundIds = new Set(locations.map((location) => location.id));
  const missingIds = locationIds.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new SeedInputError(`BusinessLocation id not found for unit seed: ${missingIds.join(', ')}`);
  }

  const existingUnits = await prisma.unitConfig.findMany({
    where: {
      OR: units.map((unit) => ({
        businessLocationId: unit.businessLocationId,
        unit: unit.unit,
      })),
    },
    select: { businessLocationId: true, unit: true },
  });

  if (existingUnits.length > 0) {
    const duplicates = existingUnits
      .map((unit) => `${unit.businessLocationId}:${unit.unit}`)
      .join(', ');
    throw new SeedInputError(`UnitConfig already exists: ${duplicates}`);
  }
}

function getTopLevelUnits(seed: SeedFile): Array<UnitSeed & { businessLocationId: string }> {
  return seed.units.map((unit, index) => {
    if (!unit.businessLocationId) {
      throw new SeedInputError(`units[${index}].businessLocationId is required for --location:unit`);
    }
    return { ...unit, businessLocationId: unit.businessLocationId };
  });
}

async function seedBusinessLocations(seed: SeedFile, options: { includeUnits: boolean; dryRun: boolean }) {
  if (seed.businessLocations.length === 0) {
    throw new SeedInputError('No businessLocations found in seed file.');
  }

  await assertBusinessLocationsCanBeCreated(seed.businessLocations);

  if (options.dryRun) {
    for (const location of seed.businessLocations) {
      const unitText = options.includeUnits ? `, units=${location.units.length}` : '';
      console.log(`[dry-run] create BusinessLocation code=${location.code}, admin=${location.admin.email}${unitText}`);
    }
    return;
  }

  for (const location of seed.businessLocations) {
    const passwordHash = await bcrypt.hash(location.admin.password, 10);

    await prisma.$transaction(async (tx) => {
      const createdLocation = await tx.businessLocation.create({ data: locationCreateData(location) });
      await tx.user.create({ data: userCreateData(location.admin, passwordHash, createdLocation.id) });

      if (options.includeUnits && location.units.length > 0) {
        await tx.unitConfig.createMany({
          data: location.units.map((unit) => unitCreateData(unit, createdLocation.id)),
        });
      }
    });

    console.log(`Created BusinessLocation ${location.code} with admin ${location.admin.email}`);
  }
}

async function seedUnits(seed: SeedFile, options: { dryRun: boolean }) {
  const units = getTopLevelUnits(seed);
  if (units.length === 0) {
    throw new SeedInputError('No top-level units found in seed file.');
  }

  await assertUnitsCanBeCreated(units);

  if (options.dryRun) {
    for (const unit of units) {
      console.log(`[dry-run] create UnitConfig ${unit.unit} for businessLocationId=${unit.businessLocationId}`);
    }
    return;
  }

  await prisma.unitConfig.createMany({
    data: units.map((unit) => unitCreateData(unit, unit.businessLocationId)),
  });

  console.log(`Created ${units.length} UnitConfig record(s).`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.mode) {
    printHelp();
    throw new SeedInputError('Missing seed mode. Use --location:all, --location:business, or --location:unit.');
  }

  const seed = readSeedFile(args.filePath);
  validateFileUniqueness(seed);

  if (args.mode === 'all') {
    await seedBusinessLocations(seed, { includeUnits: true, dryRun: args.dryRun });
  } else if (args.mode === 'business') {
    await seedBusinessLocations(seed, { includeUnits: false, dryRun: args.dryRun });
  } else {
    await seedUnits(seed, { dryRun: args.dryRun });
  }
}

main()
  .catch((error) => {
    if (error instanceof SeedInputError || error instanceof z.ZodError) {
      console.error(`Seed input error: ${error.message}`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
