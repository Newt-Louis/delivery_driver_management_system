-- Delivery lifecycle history and scheduler job history for phase 3.

ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'INCOMPLETED';

CREATE TYPE "DeliveryHistoryFinalStatus" AS ENUM (
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'INCOMPLETED'
);

CREATE TYPE "DeliveryHistoryEventType" AS ENUM (
  'REGISTERED',
  'CHECKED_IN',
  'AUTO_ASSIGNED',
  'MANUAL_CALLED',
  'RECALLED',
  'REASSIGNED_SLOT',
  'RECEIVING_STARTED',
  'AUTO_WAREHOUSE_RECEIVING_STARTED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED_NO_SHOW',
  'EXPIRED_WAITING',
  'INCOMPLETED',
  'ARCHIVED'
);

CREATE TYPE "SchedulerJobStatus" AS ENUM (
  'RUNNING',
  'SUCCESS',
  'FAILED'
);

CREATE TYPE "SchedulerJobTrigger" AS ENUM (
  'SCHEDULED',
  'MANUAL',
  'STARTUP'
);

ALTER TABLE "delivery_registrations"
  ADD COLUMN "cancel_reason" TEXT;

CREATE TABLE "delivery_history" (
  "id" TEXT NOT NULL,
  "original_delivery_id" TEXT NOT NULL,
  "registration_code" TEXT NOT NULL,
  "business_location_id" TEXT,
  "unit_config_id" TEXT,
  "receiving_unit" "ReceivingUnit" NOT NULL,
  "vendor_name" TEXT NOT NULL,
  "vendor_code" TEXT,
  "po_number" TEXT,
  "driver_name" TEXT NOT NULL,
  "driver_phone" TEXT NOT NULL,
  "vehicle_plate" TEXT NOT NULL,
  "goods_type" "GoodsType" NOT NULL,
  "unit_goods_type_id" TEXT,
  "vehicle_type" "VehicleType" NOT NULL,
  "auto_warehouse" BOOLEAN NOT NULL DEFAULT false,
  "requested_time" TIMESTAMP(3),
  "registered_at" TIMESTAMP(3) NOT NULL,
  "checkin_time" TIMESTAMP(3),
  "called_time" TIMESTAMP(3),
  "receiving_start_time" TIMESTAMP(3),
  "completed_time" TIMESTAMP(3),
  "final_status" "DeliveryHistoryFinalStatus" NOT NULL,
  "close_reason" TEXT,
  "ticket_number" INTEGER,
  "assigned_slot_id" TEXT,
  "assigned_slot_code" TEXT,
  "assigned_slot_name" TEXT,
  "call_count" INTEGER NOT NULL DEFAULT 0,
  "last_called_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "expired_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archived_by_job_run_id" TEXT,
  "duration_waiting_minutes" INTEGER,
  "duration_receiving_minutes" INTEGER,
  "note" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "delivery_history_events" (
  "id" TEXT NOT NULL,
  "delivery_history_id" TEXT,
  "delivery_registration_id" TEXT,
  "original_delivery_id" TEXT NOT NULL,
  "registration_code" TEXT NOT NULL,
  "business_location_id" TEXT,
  "unit_config_id" TEXT,
  "event_type" "DeliveryHistoryEventType" NOT NULL,
  "from_status" "DeliveryStatus",
  "to_status" "DeliveryStatus",
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "actor_type" "AuditActorType",
  "actor_id" TEXT,
  "actor_label" TEXT,
  "slot_id" TEXT,
  "slot_code" TEXT,
  "slot_name" TEXT,
  "message" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "delivery_history_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "scheduler_job_histories" (
  "id" TEXT NOT NULL,
  "job_name" TEXT NOT NULL,
  "business_date" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  "trigger" "SchedulerJobTrigger" NOT NULL DEFAULT 'SCHEDULED',
  "status" "SchedulerJobStatus" NOT NULL DEFAULT 'RUNNING',
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "processed_count" INTEGER NOT NULL DEFAULT 0,
  "succeeded_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "error_message" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scheduler_job_histories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_history_original_delivery_id_key"
  ON "delivery_history"("original_delivery_id");

CREATE UNIQUE INDEX "delivery_history_registration_code_key"
  ON "delivery_history"("registration_code");

CREATE INDEX "delivery_history_business_location_id_archived_at_idx"
  ON "delivery_history"("business_location_id", "archived_at");

CREATE INDEX "delivery_history_unit_config_id_archived_at_idx"
  ON "delivery_history"("unit_config_id", "archived_at");

CREATE INDEX "delivery_history_final_status_archived_at_idx"
  ON "delivery_history"("final_status", "archived_at");

CREATE INDEX "delivery_history_requested_time_idx"
  ON "delivery_history"("requested_time");

CREATE INDEX "delivery_history_vehicle_plate_archived_at_idx"
  ON "delivery_history"("vehicle_plate", "archived_at");

CREATE INDEX "delivery_history_events_delivery_history_id_occurred_at_idx"
  ON "delivery_history_events"("delivery_history_id", "occurred_at");

CREATE INDEX "delivery_history_events_delivery_registration_id_occurred_at_idx"
  ON "delivery_history_events"("delivery_registration_id", "occurred_at");

CREATE INDEX "delivery_history_events_original_delivery_id_occurred_at_idx"
  ON "delivery_history_events"("original_delivery_id", "occurred_at");

CREATE INDEX "delivery_history_events_registration_code_occurred_at_idx"
  ON "delivery_history_events"("registration_code", "occurred_at");

CREATE INDEX "delivery_history_events_business_location_id_occurred_at_idx"
  ON "delivery_history_events"("business_location_id", "occurred_at");

CREATE INDEX "delivery_history_events_unit_config_id_occurred_at_idx"
  ON "delivery_history_events"("unit_config_id", "occurred_at");

CREATE INDEX "delivery_history_events_event_type_occurred_at_idx"
  ON "delivery_history_events"("event_type", "occurred_at");

CREATE INDEX "scheduler_job_histories_job_name_started_at_idx"
  ON "scheduler_job_histories"("job_name", "started_at");

CREATE INDEX "scheduler_job_histories_business_date_job_name_idx"
  ON "scheduler_job_histories"("business_date", "job_name");

CREATE INDEX "scheduler_job_histories_status_started_at_idx"
  ON "scheduler_job_histories"("status", "started_at");

ALTER TABLE "delivery_history_events"
  ADD CONSTRAINT "delivery_history_events_delivery_history_id_fkey"
  FOREIGN KEY ("delivery_history_id") REFERENCES "delivery_history"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_history_events"
  ADD CONSTRAINT "delivery_history_events_delivery_registration_id_fkey"
  FOREIGN KEY ("delivery_registration_id") REFERENCES "delivery_registrations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "call_logs";
DROP TABLE IF EXISTS "staff_pins";
