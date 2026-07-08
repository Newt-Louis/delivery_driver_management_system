CREATE TABLE "user_unit_permissions" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "unit_config_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_unit_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_unit_permissions_user_id_unit_config_id_key"
  ON "user_unit_permissions"("user_id", "unit_config_id");

CREATE INDEX "user_unit_permissions_unit_config_id_idx"
  ON "user_unit_permissions"("unit_config_id");

ALTER TABLE "user_unit_permissions"
  ADD CONSTRAINT "user_unit_permissions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_unit_permissions"
  ADD CONSTRAINT "user_unit_permissions_unit_config_id_fkey"
  FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_unit_permissions" ("id", "user_id", "unit_config_id")
SELECT
  'uup_' || md5(random()::text || clock_timestamp()::text || u."id" || uc."id"),
  u."id",
  uc."id"
FROM "users" u
JOIN "unit_configs" uc
  ON uc."business_location_id" = u."business_location_id"
  AND uc."unit" = u."unit"
WHERE u."role" IN ('CHECKIN', 'RECEIVING')
  AND u."unit" IS NOT NULL
  AND u."business_location_id" IS NOT NULL
ON CONFLICT ("user_id", "unit_config_id") DO NOTHING;
