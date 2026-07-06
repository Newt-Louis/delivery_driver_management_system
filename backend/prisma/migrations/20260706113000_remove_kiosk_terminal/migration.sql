ALTER TYPE "DeviceType" RENAME VALUE 'KIOSK' TO 'FIXED_DEVICE';

ALTER TABLE "business_locations"
  DROP COLUMN IF EXISTS "kiosk_bg_url";
