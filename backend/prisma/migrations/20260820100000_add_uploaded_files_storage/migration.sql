-- CreateEnum
CREATE TYPE "UploadedFileScope" AS ENUM ('BUSINESS_LOCATION', 'UNIT_CONFIG');

-- CreateEnum
CREATE TYPE "UploadedFileCategory" AS ENUM ('LOGO', 'AVATAR', 'DOCUMENT', 'TEMPLATE', 'TMP', 'OTHER');

-- CreateTable
CREATE TABLE "uploaded_files" (
    "id" TEXT NOT NULL,
    "scope" "UploadedFileScope" NOT NULL DEFAULT 'BUSINESS_LOCATION',
    "category" "UploadedFileCategory" NOT NULL DEFAULT 'OTHER',
    "business_location_id" TEXT NOT NULL,
    "unit_config_id" TEXT,
    "uploaded_by_id" TEXT,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "relative_path" TEXT NOT NULL,
    "public_url" TEXT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uploaded_files_relative_path_key" ON "uploaded_files"("relative_path");

-- CreateIndex
CREATE INDEX "uploaded_files_business_location_id_created_at_idx" ON "uploaded_files"("business_location_id", "created_at");

-- CreateIndex
CREATE INDEX "uploaded_files_unit_config_id_created_at_idx" ON "uploaded_files"("unit_config_id", "created_at");

-- CreateIndex
CREATE INDEX "uploaded_files_category_created_at_idx" ON "uploaded_files"("category", "created_at");

-- CreateIndex
CREATE INDEX "uploaded_files_uploaded_by_id_idx" ON "uploaded_files"("uploaded_by_id");

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_business_location_id_fkey" FOREIGN KEY ("business_location_id") REFERENCES "business_locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_unit_config_id_fkey" FOREIGN KEY ("unit_config_id") REFERENCES "unit_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uploaded_files" ADD CONSTRAINT "uploaded_files_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
