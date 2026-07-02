CREATE UNIQUE INDEX "delivery_registrations_active_vehicle_plate_key"
  ON "delivery_registrations"("vehicle_plate")
  WHERE "status" IN ('REGISTERED', 'WAITING', 'CALLED', 'RECEIVING', 'AUTO_WAREHOUSE_RECEIVING');
