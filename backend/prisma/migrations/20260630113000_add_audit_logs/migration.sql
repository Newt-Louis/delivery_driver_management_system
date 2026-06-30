CREATE TYPE "AuditActorType" AS ENUM ('USER', 'STAFF', 'DEVICE', 'SYSTEM');

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_type" "AuditActorType" NOT NULL,
  "actor_id" TEXT,
  "actor_label" TEXT,
  "business_location_id" TEXT,
  "unit_config_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_business_location_id_created_at_idx"
  ON "audit_logs"("business_location_id", "created_at");

CREATE INDEX "audit_logs_unit_config_id_created_at_idx"
  ON "audit_logs"("unit_config_id", "created_at");

CREATE INDEX "audit_logs_action_created_at_idx"
  ON "audit_logs"("action", "created_at");

CREATE INDEX "audit_logs_target_type_target_id_created_at_idx"
  ON "audit_logs"("target_type", "target_id", "created_at");

CREATE INDEX "audit_logs_actor_type_actor_id_created_at_idx"
  ON "audit_logs"("actor_type", "actor_id", "created_at");
