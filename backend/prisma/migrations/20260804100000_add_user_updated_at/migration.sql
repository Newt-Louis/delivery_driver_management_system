ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);
UPDATE "users" SET "updated_at" = COALESCE("updated_at", "created_at", NOW());
ALTER TABLE "users" ALTER COLUMN "updated_at" SET NOT NULL;
