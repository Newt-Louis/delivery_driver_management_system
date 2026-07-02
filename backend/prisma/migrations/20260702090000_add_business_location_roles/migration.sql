-- Replace the first-phase role enum with the fixed business-location role model.
-- Existing demo data is mapped conservatively so the migration can run on local DBs:
-- ADMIN -> ADMIN_LOC, SECURITY -> CHECKIN, VENDOR -> CHECKIN.

CREATE TYPE "Role_new" AS ENUM ('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN');

ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE "role"::text
      WHEN 'ADMIN' THEN 'ADMIN_LOC'
      WHEN 'RECEIVING' THEN 'RECEIVING'
      WHEN 'SECURITY' THEN 'CHECKIN'
      WHEN 'VENDOR' THEN 'CHECKIN'
      ELSE 'CHECKIN'
    END
  )::"Role_new";

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CHECKIN';

UPDATE "users"
SET "business_location_id" = (
  SELECT "id"
  FROM "business_locations"
  ORDER BY "created_at" ASC
  LIMIT 1
)
WHERE "role" <> 'SUPERADMIN'
  AND "business_location_id" IS NULL
  AND EXISTS (SELECT 1 FROM "business_locations");

CREATE UNIQUE INDEX "users_single_superadmin_idx"
  ON "users" ("role")
  WHERE "role" = 'SUPERADMIN';
