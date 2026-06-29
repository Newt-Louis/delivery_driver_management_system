CREATE TABLE "ticket_sequences" (
  "id" TEXT NOT NULL,
  "ticket_date" TEXT NOT NULL,
  "receiving_unit" "ReceivingUnit" NOT NULL,
  "vehicle_type" "VehicleType" NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ticket_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ticket_sequences_ticket_date_receiving_unit_vehicle_type_key"
  ON "ticket_sequences"("ticket_date", "receiving_unit", "vehicle_type");

INSERT INTO "ticket_sequences" (
  "id",
  "ticket_date",
  "receiving_unit",
  "vehicle_type",
  "next_number",
  "created_at",
  "updated_at"
)
SELECT
  md5(
    to_char("checkin_time" + INTERVAL '7 hours', 'YYYY-MM-DD') ||
    '-' ||
    "receiving_unit"::text ||
    '-' ||
    "vehicle_type"::text
  ),
  to_char("checkin_time" + INTERVAL '7 hours', 'YYYY-MM-DD') AS "ticket_date",
  "receiving_unit",
  "vehicle_type",
  MAX("ticket_number") + 1 AS "next_number",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "delivery_registrations"
WHERE "ticket_number" IS NOT NULL
  AND "checkin_time" IS NOT NULL
GROUP BY
  to_char("checkin_time" + INTERVAL '7 hours', 'YYYY-MM-DD'),
  "receiving_unit",
  "vehicle_type";
