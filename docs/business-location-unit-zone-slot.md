# BusinessLocation, UnitConfig, Zone Và Slot

## Mục Tiêu

Cây vận hành chuẩn:

`BusinessLocation -> UnitConfig -> Zone -> Slot`

Ý nghĩa:

- `BusinessLocation`: khu vực/cơ sở vật lý.
- `UnitConfig`: đơn vị nhận hàng trong khu vực. `unit` là code động do Superadmin tạo, không còn bị giới hạn bởi enum `EMART`/`THISKYHALL`/`TENANT` trong nghiệp vụ mới.
- `Zone`: khu/khu vực vận hành thuộc một unit.
- `Slot`: vị trí nhận hàng/dock, có loại xe, sức chứa và trạng thái.

## Database

Models:

- `BusinessLocation`
  - `code`, `locationName`, `address`, `avatarUrl`, `logoUrl`, `isActive`.
  - `avatarUrl`/`logoUrl` là URL ảnh đang được location sử dụng; file vật lý và metadata upload nằm trong `datafile`/`uploaded_files`.
- `UnitConfig`
  - `businessLocationId`, `unit`, `isActive`.
  - Cấu hình loại hàng: `freshFoodEnabled`, `generalGoodsEnabled`, `thiCongEnabled`.
  - Rule Chủ nhật: `sundayFreshFoodOnly`.
  - Cấu hình capacity ngày và slot: `truckSlotMinutes`, `motorbikeSlotMinutes`, `truckMaxPerSlot`, `motorbikeMaxPerSlot`.
  - Cấu hình auto-cancel xe đã gọi không vào: `autoCancelCalledEnabled`, `autoCancelCalledAfterMinutes`.
  - Branding và API vendor/PO.
  - `logoUrl` là URL ảnh đang được đơn vị sử dụng; file vật lý và metadata upload nằm trong `datafile`/`uploaded_files`.
- `UploadedFile`
  - Metadata file upload, scope theo `BusinessLocation` hoặc `UnitConfig`.
  - File vật lý nằm dưới `DATAFILE_ROOT/uploads/<locationCode>/<unitCode?>/<yyyy>/<mm>/<dd>/`.
- `Zone`
  - `unitConfigId`, `code`, `name`.
  - Unique theo `[unitConfigId, code]`.
- `Slot`
  - `zoneId`, `assignedUnit`, `vehicleType`, `acceptedGoods`, `goodsPriority`, `autoAssign`, `autoWarehouseOnly`, `maxCapacity`, `status`, `isActive`.

Các bảng nghiệp vụ vẫn giữ cột text snapshot như `receivingUnit`, `assignedUnit`, `unit` để đọc lịch sử/report dễ hơn, nhưng source of truth quan hệ mới là `unitConfigId` khi model có field này.

Ví dụ `AutoWarehouseVendor` vẫn có cột `unit` để public register và dữ liệu cũ đọc được mã unit, nhưng route quản trị và unique nghiệp vụ dùng `unitConfigId + vendorCode`. Không dùng unique hoặc filter theo `unit + vendorCode` cho dữ liệu runtime mới, vì hai `BusinessLocation` khác nhau có thể có cùng mã unit.

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
- `GET /api/units/:unit/daily-registration-stats`

Mock order code public:

- `GET /api/units/order-codes`
  - Tạm trả 20 mã `PO##########` và 20 mã `TC##########` trong lúc chưa có API thật từ hệ thống ngoài.
  - Endpoint cũ vẫn tồn tại để tương thích, nhưng luồng thủ công `/register` hiện không còn dùng danh sách này để gợi ý hoặc đối chiếu Số PO/Mã số thi công.

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

Superadmin master data:

- `GET/POST/PATCH/DELETE /api/superadmin/business-locations`
- `GET/POST/PATCH/DELETE /api/superadmin/unit-configs`
- `GET /api/superadmin/zones`
- `GET /api/superadmin/slots`
- `GET /api/superadmin/goods-types`
- `GET /api/superadmin/time-windows`
- `GET/POST/PATCH/DELETE /api/superadmin/auto-warehouse-vendors`
- `GET/POST/PATCH/DELETE /api/superadmin/devices`
- `GET/POST/PATCH/DELETE /api/superadmin/receiving-time-configs`

File storage:

- `POST /api/files/upload`
- Static public path `/datafile/uploads/*` phục vụ file đã upload.

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

- `frontend/src/pages/Home.tsx`
- `frontend/src/features/register/steps/UnitGoodsVehicleStep.tsx`
- `frontend/src/features/register/steps/ScheduleStep.tsx`
- `frontend/src/features/register/hooks/useRegisterForm.ts`

`Home.tsx` là trang chủ public tại `/` và là điểm đặt luồng đăng ký online mới bằng mã PO/Thi Công. Các file trong `frontend/src/features/register/*` hiện thuộc luồng đăng ký thủ công tại `/register`.

Shared presentation:

- `frontend/src/lib/unitPresentation.ts`

`unitPresentation.ts` là helper dùng chung để render label, short name, icon, color và ticket prefix từ `UnitConfig` metadata. Khi một payload chỉ còn dữ liệu legacy hoặc thiếu metadata, helper sinh fallback generic từ mã unit thay vì map cứng theo `EMART`/`THISKYHALL`/`TENANT`. Các màn hình runtime như register, check-in, dashboard, docks, waiting screen, track, receiving times và histories nên dùng helper này khi cần hiển thị đơn vị.

Các route page lớn của frontend giữ layout gốc trong `frontend/src/pages/*`, còn logic/API/component con nằm trong feature folder:

- `frontend/src/pages/Dashboard.tsx` và `frontend/src/features/dashboard/*`
- `frontend/src/pages/DockManagement.tsx` và `frontend/src/features/docks/*`
- `frontend/src/pages/CheckIn.tsx` và `frontend/src/features/check-in/*`
- `frontend/src/features/waiting-screen/WaitingScreen.tsx`
- `frontend/src/features/track/Track.tsx`
- `frontend/src/features/reports/Reports.tsx`
- `frontend/src/pages/ReceivingTimes.tsx` và `frontend/src/features/receiving-times/*`
- `frontend/src/pages/DriverView.tsx` và `frontend/src/features/driver-view/*`

## Quy Tắc Hiện Tại

- `/register` thủ công không còn chọn khung giờ. Calendar tháng hiện tại dùng `daily-registration-stats` để hiển thị số xe đã đăng ký và mật độ theo ngày.
- Capacity ngày của `/register` được ước lượng từ `DeliveryTimeWindow` enabled, `truckSlotMinutes`/`motorbikeSlotMinutes` và `truckMaxPerSlot`/`motorbikeMaxPerSlot`; `DeliveryTimeWindow` không còn sinh các ô giờ để tài xế chọn trong đăng ký thủ công.
- API slot availability theo khung giờ vẫn còn để tương thích/luồng cũ, nhưng không còn là gate của `/register`.
- `UnitConfig` là master unit động. Seed chỉ là bootstrap/dev; production có thể tạo location/unit từ Superadmin.
- Ticket prefix ưu tiên `UnitConfig.shortName`, sau đó `displayName`, sau đó mã `unit`; frontend không tự giữ bảng prefix cố định theo ba unit demo.
- `Slot.zoneId` phải trỏ tới zone thuộc cùng unit với `Slot.assignedUnit`. Backend validate bằng `validateZoneForUnit()`.
- Non-`SUPERADMIN` phải đi qua `BusinessLocation` scope và `operationUnits` khi action resolve được `unitConfigId`.
- Capacity ngày không tách theo `goodsType` khi đếm số lượt đã đăng ký; goods type dùng cho eligibility, nhóm time window ước lượng và ưu tiên dispatch.
- `Slot.goodsPriority` điều khiển thứ tự ưu tiên auto-assign trong phạm vi các loại hàng slot được phép nhận. Nếu cùng một loại hàng, xe có `checkinTime`/số thứ tự sớm hơn được gọi trước.
- `MAINTENANCE` và `RESERVED` là trạng thái manual.
- `AVAILABLE` và `OCCUPIED` nên được reconcile từ active deliveries.
