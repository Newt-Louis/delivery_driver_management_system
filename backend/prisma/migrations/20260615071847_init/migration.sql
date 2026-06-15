-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'RECEIVING', 'SECURITY', 'VENDOR');

-- CreateEnum
CREATE TYPE "SlotStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ReceivingUnit" AS ENUM ('EMART', 'THISKYHALL', 'TENANT');

-- CreateEnum
CREATE TYPE "GoodsType" AS ENUM ('FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('TRUCK', 'MOTORBIKE', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('SECURITY', 'RECEIVING');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('REGISTERED', 'WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VENDOR',
    "unit" "ReceivingUnit",
    "department" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zones" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slots" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assigned_unit" "ReceivingUnit" NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'TRUCK',
    "accepted_goods" "GoodsType"[] DEFAULT ARRAY[]::"GoodsType"[],
    "auto_assign" BOOLEAN NOT NULL DEFAULT true,
    "max_capacity" INTEGER NOT NULL DEFAULT 1,
    "status" "SlotStatus" NOT NULL DEFAULT 'AVAILABLE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "current_delivery_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "zone_id" TEXT,

    CONSTRAINT "slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_registrations" (
    "id" TEXT NOT NULL,
    "registration_code" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "driver_name" TEXT NOT NULL,
    "driver_phone" TEXT NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "receiving_unit" "ReceivingUnit" NOT NULL,
    "goods_type" "GoodsType" NOT NULL,
    "po_number" TEXT,
    "requested_time" TIMESTAMP(3),
    "checkin_time" TIMESTAMP(3),
    "called_time" TIMESTAMP(3),
    "receiving_start_time" TIMESTAMP(3),
    "completed_time" TIMESTAMP(3),
    "status" "DeliveryStatus" NOT NULL DEFAULT 'REGISTERED',
    "assigned_slot_id" TEXT,
    "vehicle_type" "VehicleType" NOT NULL DEFAULT 'OTHER',
    "auto_warehouse" BOOLEAN NOT NULL DEFAULT false,
    "ticket_number" INTEGER,
    "note" TEXT,
    "unit_goods_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" TEXT NOT NULL,
    "delivery_registration_id" TEXT NOT NULL,
    "slot_id" TEXT NOT NULL,
    "called_by_user_id" TEXT,
    "called_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message" TEXT NOT NULL,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_configs" (
    "id" TEXT NOT NULL,
    "unit" "ReceivingUnit" NOT NULL,
    "fresh_food_enabled" BOOLEAN NOT NULL DEFAULT true,
    "general_goods_enabled" BOOLEAN NOT NULL DEFAULT true,
    "thi_cong_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sunday_fresh_food_only" BOOLEAN NOT NULL DEFAULT false,
    "truck_slot_minutes" INTEGER NOT NULL DEFAULT 30,
    "motorbike_slot_minutes" INTEGER NOT NULL DEFAULT 15,
    "truck_max_per_slot" INTEGER NOT NULL DEFAULT 1,
    "motorbike_max_per_slot" INTEGER NOT NULL DEFAULT 3,
    "vendor_api_url" TEXT,
    "vendor_api_key" TEXT,
    "po_api_url" TEXT,
    "po_api_key" TEXT,
    "display_name" TEXT NOT NULL DEFAULT '',
    "short_name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#1C1C1C',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_pins" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "pin" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mall_configs" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "mall_name" TEXT NOT NULL DEFAULT 'THISO GROUP',
    "logo_url" TEXT,
    "tagline" TEXT DEFAULT 'Delivery Management System',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mall_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "delivery_code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_time_configs" (
    "id" TEXT NOT NULL,
    "unit" "ReceivingUnit" NOT NULL,
    "vehicle_type" "VehicleType" NOT NULL,
    "goods_type" "GoodsType" NOT NULL,
    "configured_minutes" DOUBLE PRECISION NOT NULL DEFAULT 30,
    "recommended_minutes" DOUBLE PRECISION,
    "sample_count" INTEGER NOT NULL DEFAULT 0,
    "last_analyzed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receiving_time_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_goods_types" (
    "id" TEXT NOT NULL,
    "unit" "ReceivingUnit" NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '📦',
    "base_type" "GoodsType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_goods_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_time_windows" (
    "id" TEXT NOT NULL,
    "unit" "ReceivingUnit" NOT NULL,
    "goods_type" "GoodsType" NOT NULL,
    "unit_goods_type_id" TEXT,
    "label" TEXT,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_time_windows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "zones_code_key" ON "zones"("code");

-- CreateIndex
CREATE UNIQUE INDEX "slots_code_key" ON "slots"("code");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_registrations_registration_code_key" ON "delivery_registrations"("registration_code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_configs_unit_key" ON "unit_configs"("unit");

-- CreateIndex
CREATE UNIQUE INDEX "staff_pins_pin_key" ON "staff_pins"("pin");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_delivery_code_idx" ON "push_subscriptions"("delivery_code");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_time_configs_unit_vehicle_type_goods_type_key" ON "receiving_time_configs"("unit", "vehicle_type", "goods_type");

-- CreateIndex
CREATE INDEX "unit_goods_types_unit_base_type_idx" ON "unit_goods_types"("unit", "base_type");

-- CreateIndex
CREATE INDEX "delivery_time_windows_unit_goods_type_idx" ON "delivery_time_windows"("unit", "goods_type");

-- CreateIndex
CREATE INDEX "delivery_time_windows_unit_goods_type_id_idx" ON "delivery_time_windows"("unit_goods_type_id");

-- AddForeignKey
ALTER TABLE "slots" ADD CONSTRAINT "slots_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_registrations" ADD CONSTRAINT "delivery_registrations_assigned_slot_id_fkey" FOREIGN KEY ("assigned_slot_id") REFERENCES "slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_registrations" ADD CONSTRAINT "delivery_registrations_unit_goods_type_id_fkey" FOREIGN KEY ("unit_goods_type_id") REFERENCES "unit_goods_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_delivery_registration_id_fkey" FOREIGN KEY ("delivery_registration_id") REFERENCES "delivery_registrations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_slot_id_fkey" FOREIGN KEY ("slot_id") REFERENCES "slots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_called_by_user_id_fkey" FOREIGN KEY ("called_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_time_windows" ADD CONSTRAINT "delivery_time_windows_unit_goods_type_id_fkey" FOREIGN KEY ("unit_goods_type_id") REFERENCES "unit_goods_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
