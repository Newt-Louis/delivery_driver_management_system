-- CreateEnum
CREATE TYPE "RegistrationSource" AS ENUM ('QUICK', 'MANUAL');

-- CreateEnum
CREATE TYPE "RegistrationDeviceType" AS ENUM ('MOBILE', 'DESKTOP');

-- AlterTable
ALTER TABLE "business_locations" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "registration_history" (
    "id" TEXT NOT NULL,
    "delivery_registration_id" TEXT NOT NULL,
    "registration_code" TEXT NOT NULL,
    "business_location_id" TEXT NOT NULL,
    "unit_config_id" TEXT,
    "receiving_unit" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "vendor_code" TEXT,
    "po_number" TEXT,
    "driver_name" TEXT NOT NULL,
    "driver_phone" TEXT NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "goods_type" "GoodsType" NOT NULL,
    "original_goods_type" "GoodsType",
    "unit_goods_type_id" TEXT,
    "auto_warehouse" BOOLEAN NOT NULL DEFAULT false,
    "requested_time" TIMESTAMP(3),
    "note" TEXT,
    "registration_source" "RegistrationSource",
    "device_type" "RegistrationDeviceType",
    "user_agent" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL,
    "superseded_at" TIMESTAMP(3),
    "superseded_by_code" TEXT,
    "superseded_by_registration_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_history_registration_code_key" ON "registration_history"("registration_code");

-- CreateIndex
CREATE INDEX "registration_history_business_location_id_registered_at_idx" ON "registration_history"("business_location_id", "registered_at");

-- CreateIndex
CREATE INDEX "registration_history_business_location_id_vehicle_plate_reg_idx" ON "registration_history"("business_location_id", "vehicle_plate", "registered_at");

-- CreateIndex
CREATE INDEX "registration_history_unit_config_id_registered_at_idx" ON "registration_history"("unit_config_id", "registered_at");

-- CreateIndex
CREATE INDEX "registration_history_superseded_by_code_idx" ON "registration_history"("superseded_by_code");

-- RenameIndex
ALTER INDEX "delivery_history_events_delivery_registration_id_occurred_at_id" RENAME TO "delivery_history_events_delivery_registration_id_occurred_a_idx";

-- RenameIndex
ALTER INDEX "delivery_registrations_status_receiving_unit_vehicle_type_check" RENAME TO "delivery_registrations_status_receiving_unit_vehicle_type_c_idx";

-- RenameIndex
ALTER INDEX "delivery_registrations_unit_config_id_status_vehicle_type_check" RENAME TO "delivery_registrations_unit_config_id_status_vehicle_type_c_idx";

-- RenameIndex
ALTER INDEX "receiving_time_configs_unit_config_id_vehicle_type_goods_type_k" RENAME TO "receiving_time_configs_unit_config_id_vehicle_type_goods_ty_key";

-- RenameIndex
ALTER INDEX "slots_assigned_unit_vehicle_type_status_is_active_auto_assign_i" RENAME TO "slots_assigned_unit_vehicle_type_status_is_active_auto_assi_idx";
