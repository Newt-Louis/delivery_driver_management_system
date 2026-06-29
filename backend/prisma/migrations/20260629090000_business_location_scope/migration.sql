-- Rename mall-level singleton branding into scoped business locations.
ALTER TABLE "mall_configs" RENAME TO "business_locations";
ALTER TABLE "business_locations" RENAME CONSTRAINT "mall_configs_pkey" TO "business_locations_pkey";
ALTER TABLE "business_locations" RENAME COLUMN "mall_name" TO "location_name";

ALTER TABLE "business_locations" ADD COLUMN "code" TEXT;
UPDATE "business_locations" SET "code" = COALESCE(NULLIF("id", ''), 'DEFAULT') WHERE "code" IS NULL;
ALTER TABLE "business_locations" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "business_locations" ADD COLUMN "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "business_locations" ADD COLUMN "avatar_url" TEXT;
ALTER TABLE "business_locations" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "business_locations" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "business_locations_code_key" ON "business_locations"("code");

-- Seed a default location when migrating a database with no previous mall config row.
INSERT INTO "business_locations" (
  "id", "code", "location_name", "address", "tagline", "is_active", "created_at", "updated_at"
)
SELECT
  'singleton',
  'DEFAULT',
  'THISO GROUP',
  '',
  'Delivery Management System',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "business_locations");

-- UnitConfig is now scoped by BusinessLocation. Keep the current demo location as default.
ALTER TABLE "unit_configs" ADD COLUMN "business_location_id" TEXT;
UPDATE "unit_configs"
SET "business_location_id" = (
  SELECT "id" FROM "business_locations" WHERE "is_active" = true ORDER BY "created_at" ASC LIMIT 1
)
WHERE "business_location_id" IS NULL;
ALTER TABLE "unit_configs" ALTER COLUMN "business_location_id" SET NOT NULL;
DROP INDEX "unit_configs_unit_key";
CREATE UNIQUE INDEX "unit_configs_business_location_id_unit_key" ON "unit_configs"("business_location_id", "unit");
CREATE INDEX "unit_configs_business_location_id_idx" ON "unit_configs"("business_location_id");
ALTER TABLE "unit_configs" ADD CONSTRAINT "unit_configs_business_location_id_fkey"
  FOREIGN KEY ("business_location_id") REFERENCES "business_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep a passive scope pointer for future location-limited admins. No auth logic changes in this migration.
ALTER TABLE "users" ADD COLUMN "business_location_id" TEXT;
UPDATE "users"
SET "business_location_id" = (
  SELECT "id" FROM "business_locations" WHERE "is_active" = true ORDER BY "created_at" ASC LIMIT 1
)
WHERE "role" = 'ADMIN' AND "business_location_id" IS NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_business_location_id_fkey"
  FOREIGN KEY ("business_location_id") REFERENCES "business_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Zone now belongs to UnitConfig, creating the path BusinessLocation -> UnitConfig -> Zone -> Slot.
ALTER TABLE "zones" ADD COLUMN "unit_config_id" TEXT;
UPDATE "zones" z
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."business_location_id" = (
    SELECT "id" FROM "business_locations" WHERE "is_active" = true ORDER BY "created_at" ASC LIMIT 1
  )
  AND uc."unit" = COALESCE(
    (
      SELECT s."assigned_unit"
      FROM "slots" s
      WHERE s."zone_id" = z."id"
      GROUP BY s."assigned_unit"
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    'EMART'::"ReceivingUnit"
  )
  LIMIT 1
)
WHERE z."unit_config_id" IS NULL;

UPDATE "zones"
SET "unit_config_id" = (
  SELECT "id" FROM "unit_configs" ORDER BY "unit" ASC LIMIT 1
)
WHERE "unit_config_id" IS NULL;

ALTER TABLE "zones" ALTER COLUMN "unit_config_id" SET NOT NULL;
DROP INDEX "zones_code_key";
CREATE UNIQUE INDEX "zones_unit_config_id_code_key" ON "zones"("unit_config_id", "code");
CREATE INDEX "zones_unit_config_id_idx" ON "zones"("unit_config_id");
ALTER TABLE "zones" ADD CONSTRAINT "zones_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Slot.zone_id already exists. Make it mandatory and preserve data with a default zone if needed.
INSERT INTO "zones" ("id", "code", "name", "unit_config_id", "created_at", "updated_at")
SELECT 'zone-default', 'DEFAULT', 'Khu mặc định', uc."id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "unit_configs" uc
WHERE NOT EXISTS (SELECT 1 FROM "zones")
ORDER BY uc."unit" ASC
LIMIT 1;

UPDATE "slots"
SET "zone_id" = (SELECT "id" FROM "zones" ORDER BY "created_at" ASC LIMIT 1)
WHERE "zone_id" IS NULL;

ALTER TABLE "slots" DROP CONSTRAINT "slots_zone_id_fkey";
ALTER TABLE "slots" ALTER COLUMN "zone_id" SET NOT NULL;
ALTER TABLE "slots" ADD CONSTRAINT "slots_zone_id_fkey"
  FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
