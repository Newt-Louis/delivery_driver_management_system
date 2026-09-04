-- Registration codes are now sequenced per UnitConfig. The legacy key grouped
-- all locations with the same receiving-unit snapshot and must no longer block
-- creation of a sequence for a second location.
DROP INDEX IF EXISTS "registration_sequences_registration_date_receiving_unit_key";
