import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliveryFormRequest } from '../modules/deliveries/deliveryFormRequest';
import { SlotFormRequest } from '../modules/slots/slotFormRequest';
import { UnitFormRequest } from '../modules/units/unitFormRequest';
import { SuperadminFormRequest } from '../modules/superadmin/superadminFormRequest';

test('vehicle inputs accept only trucks and motorbikes; registration requires an explicit type', () => {
  const delivery = { driverPhone: '0901234567', vehiclePlate: '51F-12345', receivingUnit: 'EMART', goodsType: 'GENERAL_GOODS' };
  const slot = { code: 'T1', name: 'Slot', assignedUnit: 'EMART', zoneId: 'zone' };
  for (const vehicleType of ['TRUCK', 'MOTORBIKE']) {
    assert.equal(DeliveryFormRequest.parseRegister({ ...delivery, vehicleType }).vehicleType, vehicleType);
    assert.equal(SlotFormRequest.parseCreate({ ...slot, vehicleType }).vehicleType, vehicleType);
    assert.equal(UnitFormRequest.parseSlotsQuery({ date: '2026-10-28', goodsType: 'GENERAL_GOODS', vehicleType }).vehicleType, vehicleType);
    assert.equal(SuperadminFormRequest.parseReceivingTimeConfigCreate({ unitConfigId: 'unit', vehicleType, goodsType: 'GENERAL_GOODS', configuredMinutes: 30 }).vehicleType, vehicleType);
  }
  assert.throws(() => DeliveryFormRequest.parseRegister(delivery));
  assert.throws(() => DeliveryFormRequest.parseRegister({ ...delivery, vehicleType: 'OTHER' }));
  assert.throws(() => SlotFormRequest.parseCreate({ ...slot, vehicleType: 'OTHER' }));
  assert.throws(() => SlotFormRequest.parseUpdate({ vehicleType: 'OTHER' }));
  assert.throws(() => UnitFormRequest.parseSlotsQuery({ date: '2026-10-28', goodsType: 'GENERAL_GOODS', vehicleType: 'OTHER' }));
  assert.throws(() => SuperadminFormRequest.parseReceivingTimeConfigCreate({ unitConfigId: 'unit', vehicleType: 'OTHER', goodsType: 'GENERAL_GOODS', configuredMinutes: 30 }));
});
