CREATE INDEX "users_business_location_id_role_is_active_idx"
  ON "users"("business_location_id", "role", "is_active");

CREATE INDEX "slots_zone_id_idx"
  ON "slots"("zone_id");

CREATE INDEX "slots_assigned_unit_vehicle_type_status_is_active_auto_assign_idx"
  ON "slots"("assigned_unit", "vehicle_type", "status", "is_active", "auto_assign");

CREATE INDEX "slots_zone_id_vehicle_type_status_is_active_auto_assign_idx"
  ON "slots"("zone_id", "vehicle_type", "status", "is_active", "auto_assign");

CREATE INDEX "delivery_registrations_status_receiving_unit_vehicle_type_checkin_time_idx"
  ON "delivery_registrations"("status", "receiving_unit", "vehicle_type", "checkin_time");

CREATE INDEX "delivery_registrations_assigned_slot_id_status_idx"
  ON "delivery_registrations"("assigned_slot_id", "status");

CREATE INDEX "delivery_registrations_vehicle_plate_created_at_idx"
  ON "delivery_registrations"("vehicle_plate", "created_at");

CREATE INDEX "delivery_registrations_requested_time_idx"
  ON "delivery_registrations"("requested_time");

CREATE INDEX "delivery_registrations_created_at_idx"
  ON "delivery_registrations"("created_at");

CREATE INDEX "ticket_sequences_receiving_unit_vehicle_type_ticket_date_idx"
  ON "ticket_sequences"("receiving_unit", "vehicle_type", "ticket_date");

CREATE INDEX "call_logs_delivery_registration_id_called_at_idx"
  ON "call_logs"("delivery_registration_id", "called_at");

CREATE INDEX "call_logs_slot_id_called_at_idx"
  ON "call_logs"("slot_id", "called_at");

CREATE INDEX "staff_pins_role_active_idx"
  ON "staff_pins"("role", "active");
