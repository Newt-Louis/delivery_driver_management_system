CREATE TYPE "DeviceType" AS ENUM ('KIOSK', 'PDA', 'TABLET', 'TV');

CREATE TABLE "devices" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "business_location_id" TEXT NOT NULL,
  "device_type" "DeviceType" NOT NULL DEFAULT 'KIOSK',
  "device_secret_hash" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "devices_code_key" ON "devices"("code");

CREATE INDEX "devices_business_location_id_device_type_is_active_idx"
  ON "devices"("business_location_id", "device_type", "is_active");

ALTER TABLE "devices" ADD CONSTRAINT "devices_business_location_id_fkey"
  FOREIGN KEY ("business_location_id") REFERENCES "business_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
