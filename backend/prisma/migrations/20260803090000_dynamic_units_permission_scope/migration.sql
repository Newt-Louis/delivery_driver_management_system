-- Dynamic unit scope migration.
-- Legacy ReceivingUnit enum values are converted to text snapshots; UnitConfig
-- becomes the database-owned unit source scoped by business_location_id.

ALTER TABLE "users" ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;
ALTER TABLE "unit_configs" ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;
ALTER TABLE "slots" ALTER COLUMN "assigned_unit" TYPE TEXT USING "assigned_unit"::TEXT;
ALTER TABLE "delivery_registrations" ALTER COLUMN "receiving_unit" TYPE TEXT USING "receiving_unit"::TEXT;
ALTER TABLE "ticket_sequences" ALTER COLUMN "receiving_unit" TYPE TEXT USING "receiving_unit"::TEXT;
ALTER TABLE "registration_sequences" ALTER COLUMN "receiving_unit" TYPE TEXT USING "receiving_unit"::TEXT;
ALTER TABLE "delivery_history" ALTER COLUMN "receiving_unit" TYPE TEXT USING "receiving_unit"::TEXT;
ALTER TABLE "auto_warehouse_vendors" ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;
ALTER TABLE "receiving_time_configs" ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;
ALTER TABLE "unit_goods_types" ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;
ALTER TABLE "delivery_time_windows" ALTER COLUMN "unit" TYPE TEXT USING "unit"::TEXT;

ALTER TABLE "unit_configs" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE "delivery_registrations" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;
ALTER TABLE "ticket_sequences" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;
ALTER TABLE "registration_sequences" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;
ALTER TABLE "auto_warehouse_vendors" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;
ALTER TABLE "receiving_time_configs" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;
ALTER TABLE "unit_goods_types" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;
ALTER TABLE "delivery_time_windows" ADD COLUMN IF NOT EXISTS "unit_config_id" TEXT;

-- Backfill active delivery unit scope from assigned slot when available.
UPDATE "delivery_registrations" d
SET "unit_config_id" = z."unit_config_id"
FROM "slots" s
JOIN "zones" z ON z."id" = s."zone_id"
WHERE d."assigned_slot_id" = s."id"
  AND d."unit_config_id" IS NULL;

-- Backfill remaining rows by matching the legacy unit code to the first matching UnitConfig.
UPDATE "delivery_registrations" d
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = d."receiving_unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE d."unit_config_id" IS NULL;

UPDATE "delivery_history" h
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = h."receiving_unit"
    AND (h."business_location_id" IS NULL OR uc."business_location_id" = h."business_location_id")
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE h."unit_config_id" IS NULL;

UPDATE "delivery_history_events" e
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE e."unit_config_id" IS NULL
    AND e."business_location_id" = uc."business_location_id"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE e."unit_config_id" IS NULL
  AND e."business_location_id" IS NOT NULL;

UPDATE "ticket_sequences" t
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = t."receiving_unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE t."unit_config_id" IS NULL;

UPDATE "registration_sequences" r
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = r."receiving_unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE r."unit_config_id" IS NULL;

UPDATE "auto_warehouse_vendors" v
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = v."unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE v."unit_config_id" IS NULL;

UPDATE "receiving_time_configs" c
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = c."unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE c."unit_config_id" IS NULL;

UPDATE "unit_goods_types" g
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = g."unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE g."unit_config_id" IS NULL;

UPDATE "delivery_time_windows" w
SET "unit_config_id" = g."unit_config_id"
FROM "unit_goods_types" g
WHERE w."unit_goods_type_id" = g."id"
  AND w."unit_config_id" IS NULL;

UPDATE "delivery_time_windows" w
SET "unit_config_id" = (
  SELECT uc."id"
  FROM "unit_configs" uc
  WHERE uc."unit" = w."unit"
  ORDER BY uc."created_at" ASC
  LIMIT 1
)
WHERE w."unit_config_id" IS NULL;

ALTER TABLE "delivery_registrations"
  ADD CONSTRAINT "delivery_registrations_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ticket_sequences"
  ADD CONSTRAINT "ticket_sequences_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "registration_sequences"
  ADD CONSTRAINT "registration_sequences_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "auto_warehouse_vendors"
  ADD CONSTRAINT "auto_warehouse_vendors_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "receiving_time_configs"
  ADD CONSTRAINT "receiving_time_configs_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "unit_goods_types"
  ADD CONSTRAINT "unit_goods_types_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "delivery_time_windows"
  ADD CONSTRAINT "delivery_time_windows_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "delivery_registrations_unit_config_id_status_vehicle_type_checkin_time_idx"
  ON "delivery_registrations"("unit_config_id", "status", "vehicle_type", "checkin_time");
CREATE INDEX IF NOT EXISTS "ticket_sequences_unit_config_id_vehicle_type_ticket_date_idx"
  ON "ticket_sequences"("unit_config_id", "vehicle_type", "ticket_date");
CREATE UNIQUE INDEX IF NOT EXISTS "ticket_sequences_ticket_date_unit_config_id_vehicle_type_key"
  ON "ticket_sequences"("ticket_date", "unit_config_id", "vehicle_type");
CREATE INDEX IF NOT EXISTS "registration_sequences_unit_config_id_registration_date_idx"
  ON "registration_sequences"("unit_config_id", "registration_date");
CREATE UNIQUE INDEX IF NOT EXISTS "registration_sequences_registration_date_unit_config_id_key"
  ON "registration_sequences"("registration_date", "unit_config_id");
CREATE INDEX IF NOT EXISTS "auto_warehouse_vendors_unit_config_id_active_idx"
  ON "auto_warehouse_vendors"("unit_config_id", "active");
CREATE UNIQUE INDEX IF NOT EXISTS "auto_warehouse_vendors_unit_config_id_vendor_code_key"
  ON "auto_warehouse_vendors"("unit_config_id", "vendor_code");
CREATE INDEX IF NOT EXISTS "receiving_time_configs_unit_config_id_idx"
  ON "receiving_time_configs"("unit_config_id");
CREATE UNIQUE INDEX IF NOT EXISTS "receiving_time_configs_unit_config_id_vehicle_type_goods_type_key"
  ON "receiving_time_configs"("unit_config_id", "vehicle_type", "goods_type");
CREATE INDEX IF NOT EXISTS "unit_goods_types_unit_config_id_base_type_idx"
  ON "unit_goods_types"("unit_config_id", "base_type");
CREATE UNIQUE INDEX IF NOT EXISTS "unit_goods_types_unit_config_id_base_type_name_key"
  ON "unit_goods_types"("unit_config_id", "base_type", "name");
CREATE INDEX IF NOT EXISTS "delivery_time_windows_unit_config_id_goods_type_idx"
  ON "delivery_time_windows"("unit_config_id", "goods_type");
