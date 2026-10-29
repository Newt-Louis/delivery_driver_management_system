-- A dock code is meaningful within its physical zone. Different locations can
-- therefore each use the operational labels T1, M1, E1, and so on.
DROP INDEX "slots_code_key";
CREATE UNIQUE INDEX "slots_zone_id_code_key" ON "slots"("zone_id", "code");
