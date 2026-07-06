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

1. Chọn đơn vị, loại hàng, loại xe.
2. Chọn ngày và khung giờ.
3. Nhập thông tin tài xế/xe/nhà cung cấp.
4. Review và hoàn tất đăng ký.

Logic trong `useRegisterForm.ts`:

- Lấy cấu hình unit: `GET /api/units/:unit/config`.
- Lấy loại hàng tùy biến: `GET /api/units/:unit/goods-types`.
- Lấy vehicle availability: `GET /api/units/:unit/vehicle-availability`.
- Lấy slot availability: `GET /api/units/:unit/slots`.
- Check vendor kho tự động: `GET /api/aw-vendors/check`.
- Submit: `POST /api/deliveries/register`.
- Scroll tới field lỗi đầu tiên khi validate fail.
- Khi sửa từ step review, bấm tiếp theo quay lại step 4.

## Backend

API chính:

- `POST /api/deliveries/register`
- `GET /api/units/:unit/config`
- `GET /api/units/:unit/goods-types`
- `GET /api/units/:unit/vehicle-availability`
- `GET /api/units/:unit/slots`
- `GET /api/aw-vendors/check`

Hàm quan trọng trong `backend/src/routes/deliveries.ts`:

- `normalizeVehiclePlate()`
- `findActiveDeliveryByPlate()`
- `sendDuplicateRegistration()`
- `ensureRegistrationSlotCapacity()`
- `isSundayDeliveryDate()`

Service:

- `backend/src/services/registrationSequence.ts`
  - `reserveRegistrationCode()` cấp registration code atomic theo ngày VN và receiving unit.

## Rule Nghiệp Vụ

- Biển số xe được normalize uppercase và bỏ khoảng trắng.
- Nếu xe đã có lượt active, API trả thông tin duplicate để tài xế tiếp tục tracking thay vì tạo trùng.
- Nếu unit bật `sundayFreshFoodOnly`, ngày Chủ nhật chỉ cho `FRESH_FOOD`.
- Backend validate lại capacity slot khi submit để tránh frontend bị stale.
- Capacity slot tính theo:
  - unit
  - vehicleType
  - deliveryDate/timeSlot
  - active statuses: `REGISTERED`, `WAITING`, `CALLED`, `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING`
- Capacity không tách theo `goodsType`.

## Output Thành Công

`POST /api/deliveries/register` trả delivery đã tạo, gồm `registrationCode`. Frontend `SuccessScreen`:

- Hiển thị QR/mã đăng ký.
- Cho nút theo dõi.
- Tự động đếm ngược 10 giây và điều hướng sang `/track/:code`.
