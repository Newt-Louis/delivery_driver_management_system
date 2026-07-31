# BusinessLocation, UnitConfig, Zone Và Slot

## Mục Tiêu

Cây vận hành chuẩn:

`BusinessLocation -> UnitConfig -> Zone -> Slot`

Ý nghĩa:

- `BusinessLocation`: khu vực/cơ sở vật lý.
- `UnitConfig`: đơn vị nhận hàng trong khu vực, ví dụ `EMART`, `THISKYHALL`, `TENANT`.
- `Zone`: khu/khu vực vận hành thuộc một unit.
- `Slot`: vị trí nhận hàng/dock, có loại xe, sức chứa và trạng thái.

## Database

Models:

- `BusinessLocation`
  - `code`, `locationName`, `address`, `avatarUrl`, `logoUrl`, `isActive`.
- `UnitConfig`
  - `businessLocationId`, `unit`.
  - Cấu hình loại hàng: `freshFoodEnabled`, `generalGoodsEnabled`, `thiCongEnabled`.
  - Rule Chủ nhật: `sundayFreshFoodOnly`.
  - Cấu hình khung giờ: `truckSlotMinutes`, `motorbikeSlotMinutes`.
  - Branding và API vendor/PO.
- `Zone`
  - `unitConfigId`, `code`, `name`.
  - Unique theo `[unitConfigId, code]`.
- `Slot`
  - `zoneId`, `assignedUnit`, `vehicleType`, `acceptedGoods`, `autoAssign`, `autoWarehouseOnly`, `maxCapacity`, `status`, `isActive`.

## Backend APIs

Unit config:

- `GET /api/units/configs`
- `GET /api/units/:unit/config`
- `PATCH /api/units/:unit/config`

Custom goods type:

- `GET /api/units/:unit/goods-types`
- `POST /api/units/:unit/goods-types`
- `PATCH /api/units/goods-types/:id`
- `DELETE /api/units/goods-types/:id`

Time windows:

- `GET /api/units/:unit/time-windows`
- `POST /api/units/:unit/time-windows`
- `PATCH /api/units/time-windows/:id`
- `DELETE /api/units/time-windows/:id`

Vehicle/slot availability public:

- `GET /api/units/:unit/vehicle-availability`
- `GET /api/units/:unit/slots`

Zones:

- `GET /api/zones`
- `POST /api/zones`
- `PATCH /api/zones/:id`
- `DELETE /api/zones/:id`

Slots:

- `GET /api/slots`
- `GET /api/slots/all`
- `POST /api/slots`
- `PATCH /api/slots/:id`
- `DELETE /api/slots/:id`
- `PATCH /api/slots/:id/status`
- `PATCH /api/slots/:id/assign`
- `POST /api/slots/:id/reconcile`
- `POST /api/slots/reconcile`

Module backend:

- `backend/src/routes/zones.ts`: controller mỏng cho endpoint zone.
- `backend/src/modules/zones/zoneFormRequest.ts`: validate payload zone bằng Zod.
- `backend/src/modules/zones/zoneRepository.ts`: query `Zone`/`UnitConfig`.
- `backend/src/modules/zones/zoneService.ts`: rule tạo/sửa/xóa zone, scope decision và audit.
- `backend/src/routes/units.ts`: controller mỏng cho endpoint unit config, custom goods type, time window và availability public.
- `backend/src/modules/units/unitFormRequest.ts`: validate params/query/body của unit API bằng Zod.
- `backend/src/modules/units/unitRepository.ts`: query `BusinessLocation`, `UnitConfig`, `UnitGoodsType`, `DeliveryTimeWindow`, `Slot` và booking active.
- `backend/src/modules/units/unitService.ts`: rule scope location, CRUD unit settings, tính vehicle/slot availability, proxy vendor/PO và audit.
- `backend/src/routes/slots.ts`: controller mỏng cho endpoint slot.
- `backend/src/modules/slots/slotFormRequest.ts`: validate payload/status/query slot bằng Zod.
- `backend/src/modules/slots/slotRepository.ts`: query slot/zone/delivery/history.
- `backend/src/modules/slots/slotService.ts`: rule CRUD, assign trực tiếp, reconcile, audit và emit `slot_updated`.

## Hàm Quan Trọng

- `resolveLocationId(user, scope)` trong `modules/units/unitService.ts`.
- `assertUnitInLocation(unit, businessLocationId)` trong `modules/units/unitService.ts`.
- `listMatchingOperationalSlots()` trong `modules/units/unitRepository.ts`.
- `timeToMinutes()`, `minutesToTime()` và `unitAcceptsGoods()` trong `helperFunction.ts`.
- `validateZoneForUnit()` trong `modules/slots/slotRepository.ts`.
- `reconcileSlotState()` trong `services/slotState.ts`.
- `reconcileOneSlot()` và `reconcileAllSlots()` trong `services/slotState.ts`.

## Frontend

Backoffice:

- `frontend/src/pages/Backoffice.tsx`: shell page.
- `frontend/src/features/backoffice/tabs/UnitsTab.tsx`
- `frontend/src/features/backoffice/tabs/ZonesTab.tsx`
- `frontend/src/features/backoffice/tabs/SlotsTab.tsx`
- `frontend/src/features/backoffice/tabs/BrandTab.tsx`

Register:

- `frontend/src/features/register/steps/UnitGoodsVehicleStep.tsx`
- `frontend/src/features/register/steps/ScheduleStep.tsx`
- `frontend/src/features/register/hooks/useRegisterForm.ts`

## Quy Tắc Hiện Tại

- Slot availability trong register tính theo tổng `Slot.maxCapacity` của các slot active, đúng vehicle type, không phải theo cột legacy `truckMaxPerSlot`/`motorbikeMaxPerSlot`.
- Capacity không tách theo `goodsType`; goods type dùng cho eligibility, khung giờ và ưu tiên dispatch.
- `MAINTENANCE` và `RESERVED` là trạng thái manual.
- `AVAILABLE` và `OCCUPIED` nên được reconcile từ active deliveries.
