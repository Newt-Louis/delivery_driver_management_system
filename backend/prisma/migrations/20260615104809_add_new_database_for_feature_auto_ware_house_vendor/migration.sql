-- AlterTable
ALTER TABLE "delivery_registrations" ADD COLUMN     "vendor_code" TEXT;

-- AlterTable
ALTER TABLE "mall_configs" ADD COLUMN     "kiosk_bg_url" TEXT;

-- AlterTable
ALTER TABLE "slots" ADD COLUMN     "auto_warehouse_only" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "auto_warehouse_vendors" (
    "id" TEXT NOT NULL,
    "unit" "ReceivingUnit" NOT NULL,
    "vendor_code" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_warehouse_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_warehouse_vendors_unit_vendor_code_key" ON "auto_warehouse_vendors"("unit", "vendor_code");
