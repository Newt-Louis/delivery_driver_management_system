# Luồng Tài Xế Đăng Ký Giao Hàng

## Mục Tiêu

Tài xế/NCC đăng ký giao hàng công khai tại `/register`, không cần đăng nhập. Sau khi đăng ký thành công, tài xế nhận:

- `registrationCode`
- QR code/tracking code
- Nút theo dõi hành trình tự động đếm ngược và chuyển sang `/track/:code`

## Frontend

Files:

- `frontend/src/pages/Register.tsx`
- `frontend/src/features/register/hooks/useRegisterForm.ts`
- `frontend/src/features/register/api.ts`
- `frontend/src/features/register/types.ts`
- `frontend/src/features/register/constants.ts`
- `frontend/src/features/register/steps/UnitGoodsVehicleStep.tsx`
- `frontend/src/features/register/steps/ScheduleStep.tsx`
- `frontend/src/features/register/steps/DriverInfoStep.tsx`
- `frontend/src/features/register/steps/ReviewSubmitStep.tsx`
- `frontend/src/features/register/components/SuccessScreen.tsx`
- `frontend/src/features/register/components/FieldFrame.tsx`
- `frontend/src/features/register/components/FieldFeedback.tsx`
- `frontend/src/features/register/components/OtherTimeModal.tsx`

Wizard:

1. Chọn `BusinessLocation`, đơn vị nhận hàng, loại hàng, loại xe.
2. Chọn ngày và khung giờ.
3. Nhập thông tin tài xế/xe/nhà cung cấp.
4. Review và hoàn tất đăng ký.

Logic trong `useRegisterForm.ts`:

- Lấy danh sách khu vực public: `GET /api/units/public/business-locations`.
- Sau khi chọn khu vực, lấy unit active: `GET /api/units/public/configs?businessLocationId=...`.
- Lấy cấu hình unit: `GET /api/units/:unit/config?businessLocationId=...&unitConfigId=...`.
- Lấy loại hàng tùy biến: `GET /api/units/:unit/goods-types?businessLocationId=...&unitConfigId=...`. Dữ liệu nằm trong `unit_goods_types`, scope chính theo `unitConfigId` để không lẫn giữa các `BusinessLocation`.
- Lấy vehicle availability: `GET /api/units/:unit/vehicle-availability?businessLocationId=...&unitConfigId=...`.
- Lấy slot availability: `GET /api/units/:unit/slots?businessLocationId=...&unitConfigId=...`.
- Check vendor kho tự động: `GET /api/aw-vendors/check?code=...&unit=...&businessLocationId=...&unitConfigId=...`.
- Submit: `POST /api/deliveries/register` với `businessLocationId`, `unitConfigId` và unit code snapshot.
- Scroll tới field lỗi đầu tiên khi validate fail.
- Khi sửa từ step review, bấm tiếp theo quay lại step 4.

## Backend

API chính:

- `POST /api/deliveries/register`
- `GET /api/units/public/business-locations`
- `GET /api/units/public/configs`
- `GET /api/units/:unit/config`
- `GET /api/units/:unit/goods-types`
- `GET /api/units/:unit/vehicle-availability`
- `GET /api/units/:unit/slots`
- `GET /api/units/order-codes`
- `GET /api/aw-vendors/check`
- `POST /api/deliveries/public-cancel`

Module backend:

- `backend/src/routes/deliveries.ts`: controller mỏng cho endpoint đăng ký và lifecycle delivery.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: validate payload đăng ký, public cancel, check-in lookup, call/cancel và query list.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery, queue, resolve `UnitConfig`, slot capacity, duplicate theo ngày giao và auto-warehouse vendor.
- `backend/src/modules/deliveries/deliveryService.ts`: rule đăng ký, duplicate theo `vehiclePlate + driverPhone + poNumber` trong ngày giao, public cancel, capacity lock, Sunday fresh-food-only, history event và response.
- `backend/src/routes/units.ts`: controller mỏng cho unit config, goods type, vehicle availability và slot availability public.
- `backend/src/modules/units/unitFormRequest.ts`: validate params/query/body của unit API.
- `backend/src/modules/units/unitRepository.ts`: query cấu hình unit, khung giờ, slot vận hành và booking active.
- `backend/src/modules/units/unitService.ts`: rule nhận loại hàng, tính capacity theo slot active và strip secret khỏi public config.
- `backend/src/modules/units/orderCodeMock.ts`: danh sách mock 20 mã PO và 20 mã Thi Công trong lúc API thật chưa có.

Hàm quan trọng trong module:

- `normalizeVehiclePlate()` trong `deliveryRepository.ts`.
- `normalizeDriverPhone()` và `normalizeOrderCode()` trong `deliveryRepository.ts`.
- `findDuplicateRegistration()` trong `deliveryRepository.ts`.
- `findDeliveryForPublicCancel()` trong `deliveryRepository.ts`.
- `ensureRegistrationSlotCapacity()` trong `deliveryService.ts`.
- `isSundayDeliveryDate()` trong `deliveryService.ts`.
- `getAvailableSlots()` và `getVehicleAvailability()` trong `modules/units/unitService.ts`.

Service:

- `backend/src/services/registrationSequence.ts`
  - `reserveRegistrationCode()` cấp registration code atomic theo ngày VN và receiving unit.

## Rule Nghiệp Vụ

- Biển số xe được normalize uppercase và bỏ khoảng trắng.
- Số điện thoại duplicate được normalize chỉ còn chữ số.
- Số PO/Mã thi công được normalize uppercase và bỏ ký tự phân cách.
- Trong lúc chưa có API thật, `GET /api/units/order-codes` trả mock 20 mã `PO##########` và 20 mã `TC##########`; backend register vẫn validate lại mã này.
- `BusinessLocation` public là bước đầu của `/register`; frontend không hardcode danh sách unit. Unit hiển thị từ `unit_configs` active của khu vực được chọn.
- Submit register phải có `unitConfigId`. Backend validate `unitConfigId` active, thuộc `businessLocationId` đã chọn và có unit code trùng `receivingUnit`.
- Duplicate registration chỉ bị chặn khi cùng ngày giao đã chọn có lượt active trùng đủ cả ba thông tin `vehiclePlate + driverPhone + poNumber` trong cùng `unitConfigId`.
- Cùng biển số vẫn được đăng ký ngày khác, hoặc cùng ngày nhưng khác số điện thoại/PO/TC.
- Tài xế chỉ có thể tự hủy chuyến tại `/cancelled` trước khi check-in, tức delivery còn `REGISTERED`; endpoint public đối chiếu đúng 5 trường `vehiclePlate`, `driverPhone`, `poNumber`, `registrationCode`, `requestedTime`, sau đó archive lịch sử với lý do `Tài xế thao tác hủy` và xóa row operational.
- Nếu unit bật `sundayFreshFoodOnly`, ngày Chủ nhật chỉ cho `FRESH_FOOD`.
- Backend validate lại capacity slot khi submit để tránh frontend bị stale.
- Capacity slot tính theo:
  - `unitConfigId`
  - unit code snapshot
  - vehicleType
  - deliveryDate/timeSlot
  - active statuses: `REGISTERED`, `WAITING`, `CALLED`, `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING`
- Capacity không tách theo `goodsType`.
- `UnitGoodsType`, `DeliveryTimeWindow` và `AutoWarehouseVendor` có `unitConfigId` là scope chính; cột `unit` là code snapshot/compat cho API theo `:unit`.
- Nếu unit có custom goods type enabled, frontend hiển thị danh mục custom đó; nếu không có time window riêng cho custom type thì backend/frontend fallback về time window base goods type của cùng unit.

## Output Thành Công

`POST /api/deliveries/register` trả delivery đã tạo, gồm `registrationCode`. Frontend `SuccessScreen`:

- Hiển thị QR/mã đăng ký.
- Cho nút theo dõi.
- Tự động đếm ngược 10 giây và điều hướng sang `/track/:code`.
