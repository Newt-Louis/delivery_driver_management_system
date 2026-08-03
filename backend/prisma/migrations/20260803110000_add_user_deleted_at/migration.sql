ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");
