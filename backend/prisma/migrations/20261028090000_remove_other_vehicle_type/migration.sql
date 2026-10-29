-- Preserve historical data: never silently reclassify or delete OTHER rows.
-- Resolve any rows explicitly before deploying this migration.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "slots" WHERE "vehicle_type"::text = 'OTHER')
    OR EXISTS (SELECT 1 FROM "delivery_registrations" WHERE "vehicle_type"::text = 'OTHER')
    OR EXISTS (SELECT 1 FROM "delivery_history" WHERE "vehicle_type"::text = 'OTHER')
    OR EXISTS (SELECT 1 FROM "ticket_sequences" WHERE "vehicle_type"::text = 'OTHER')
    OR EXISTS (SELECT 1 FROM "receiving_time_configs" WHERE "vehicle_type"::text = 'OTHER') THEN
    RAISE EXCEPTION 'Cannot remove VehicleType OTHER: existing data must be reviewed and resolved first';
  END IF;
END $$;

ALTER TABLE "slots" ALTER COLUMN "vehicle_type" DROP DEFAULT;
ALTER TABLE "delivery_registrations" ALTER COLUMN "vehicle_type" DROP DEFAULT;
ALTER TYPE "VehicleType" RENAME TO "VehicleType_old";
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'MOTORBIKE');
ALTER TABLE "slots" ALTER COLUMN "vehicle_type" TYPE "VehicleType" USING ("vehicle_type"::text::"VehicleType");
ALTER TABLE "delivery_registrations" ALTER COLUMN "vehicle_type" TYPE "VehicleType" USING ("vehicle_type"::text::"VehicleType");
ALTER TABLE "delivery_history" ALTER COLUMN "vehicle_type" TYPE "VehicleType" USING ("vehicle_type"::text::"VehicleType");
ALTER TABLE "ticket_sequences" ALTER COLUMN "vehicle_type" TYPE "VehicleType" USING ("vehicle_type"::text::"VehicleType");
ALTER TABLE "receiving_time_configs" ALTER COLUMN "vehicle_type" TYPE "VehicleType" USING ("vehicle_type"::text::"VehicleType");
ALTER TABLE "slots" ALTER COLUMN "vehicle_type" SET DEFAULT 'TRUCK'::"VehicleType";
DROP TYPE "VehicleType_old";
COMMIT;
