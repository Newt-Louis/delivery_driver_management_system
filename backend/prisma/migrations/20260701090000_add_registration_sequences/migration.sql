CREATE TABLE "registration_sequences" (
  "id" TEXT NOT NULL,
  "registration_date" TEXT NOT NULL,
  "receiving_unit" "ReceivingUnit" NOT NULL,
  "next_number" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registration_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "registration_sequences_registration_date_receiving_unit_key"
  ON "registration_sequences"("registration_date", "receiving_unit");

CREATE INDEX "registration_sequences_receiving_unit_registration_date_idx"
  ON "registration_sequences"("receiving_unit", "registration_date");
