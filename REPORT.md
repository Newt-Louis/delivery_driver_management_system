# REPORT.md

Báo cáo các tính năng đã hoàn thành để đối soát với `PLAN.md` và làm nguồn tổng hợp cho tài liệu trong `docs/`.

Quy ước:

- Mỗi mục phải ghi rõ đã hoàn thành gì.
- Nên ghi file/API/service chính đã thay đổi.
- Nên ghi lệnh kiểm tra đã chạy nếu có.
- Không dùng file này để lên kế hoạch tương lai; kế hoạch nằm trong `PLAN.md`.

## Giai Đoạn 1 - Nền Tảng Vận Hành Và Chịu Tải

### 2026-06-30 - Ticket Sequence Và Check-in Idempotency

- Thêm `TicketSequence` để cấp ticket atomic theo ngày VN + `ReceivingUnit` + `VehicleType`.
- Thêm `checkInDelivery()` và `reserveTicketNumber()` để lock delivery row trước khi check-in.
- Các luồng check-in chính không còn cấp ticket bằng `max(ticketNumber) + 1`.
- Scan/check-in lặp khi delivery đã `WAITING` trả lại ticket hiện tại, không cấp mới.
- File chính: `backend/src/services/checkInDelivery.ts`, `backend/src/services/ticketSequence.ts`, `backend/src/routes/deliveries.ts`, `backend/src/routes/checkin.ts`, `backend/src/routes/track.ts`.

### 2026-06-30 - Auto-assign Concurrency

- Refactor `triggerAutoAssign()` thành luồng transaction cho từng slot.
- Lock slot bằng `FOR UPDATE`, chọn delivery bằng `FOR UPDATE SKIP LOCKED`.
- Recheck capacity sau lock để không gọi vượt `maxCapacity`.
- Giữ rule slot kho tự động, slot thường và ưu tiên `FRESH_FOOD`.
- File chính: `backend/src/services/autoAssign.ts`.

### 2026-06-30 - Manual Call Concurrency

- Thêm `manualCallDelivery()` cho `PATCH /api/deliveries/:id/call`.
- Lock delivery + slot trong một transaction.
- Manual call idempotent nếu delivery đã được gọi vào đúng slot.
- Reassign delivery sang slot khác sẽ release old slot trong transaction.
- File chính: `backend/src/services/manualCallDelivery.ts`, `backend/src/routes/deliveries.ts`.

### 2026-06-30 - Complete/Cancel Concurrency

- Thêm `completeDelivery()` và `cancelDelivery()` trong `deliveryLifecycle`.
- Complete/cancel lock delivery, validate status sau lock và release slot trong transaction.
- Complete/cancel idempotent, tránh emit/push/auto-assign lặp.
- File chính: `backend/src/services/deliveryLifecycle.ts`.

### 2026-06-30 - Slot Status Reconcile

- Thêm `slotState` để quy định `MAINTENANCE`/`RESERVED` là trạng thái manual, `AVAILABLE`/`OCCUPIED` là trạng thái tính từ active deliveries.
- Thêm endpoint reconcile một slot hoặc toàn bộ slot.
- Manual call, auto-assign và complete/cancel chuyển sang dùng reconcile.
- File chính: `backend/src/services/slotState.ts`, `backend/src/routes/slots.ts`.

### 2026-06-30 - Operational Database Indexes

- Thêm index cho queue/check-in/tracking, slot dashboard, call logs, users, staff pins và ticket sequences.
- Thêm partial unique index để chỉ cho phép một `SUPERADMIN`.
- File chính: migration `20260630103000_add_operational_indexes`.

### 2026-06-30 - Device Auth Cho Kiosk/PDA

- Thêm model `Device`, route `/api/devices`, terminal auth `/api/checkin/terminal-auth`.
- Terminal token có `deviceId`, `deviceCode`, `deviceType`, `businessLocationId`, `staffPinId`, `staffRole`.
- Device API không trả `deviceSecretHash`.
- File chính: `backend/src/routes/devices.ts`, `backend/src/routes/checkin.ts`, `frontend/src/pages/Kiosk.tsx`.

### 2026-06-30 - Audit Log Hành Động Quan Trọng

- Thêm `AuditLog` và service `recordAuditLog()`.
- Ghi audit cho check-in, manual call, auto-assign, start receiving, complete, cancel và device CRUD.
- Audit fail-safe, lỗi ghi audit không làm fail nghiệp vụ chính.
- File chính: `backend/src/services/auditLog.ts`, `backend/src/routes/auditLogs.ts`.

### 2026-06-30 - Concurrency Test Suite

- Thêm `npm run test:concurrency`.
- Test các race condition: check-in đồng thời, scan cùng QR, manual call, multi-capacity slot, complete đồng thời, auto-assign rule.
- File chính: `backend/src/tests/concurrency.test.ts`.

### 2026-07-01 - Load Test Artillery Và Registration Code Sequence

- Thêm Artillery load test với `load-test.yml` và `processor.js`.
- Load test bắt lỗi sinh `registrationCode` bằng `count + 1`.
- Thêm `RegistrationSequence` và `reserveRegistrationCode()` để cấp mã đăng ký atomic theo ngày VN + unit.
- File chính: `backend/load-test.yml`, `backend/processor.js`, `backend/src/services/registrationSequence.ts`, `backend/src/routes/deliveries.ts`.

### 2026-07-01 - Rate Limit Cho Auth/PIN/Public API

- Thêm middleware rate limit in-memory.
- Áp dụng cho login, terminal auth, track staff action, register, push subscribe, track search và slot availability.
- File chính: `backend/src/middleware/rateLimit.ts`.

### 2026-07-01 - Seed BusinessLocation Và UnitConfig Theo JSON

- Thêm `npm run db:seed`.
- Hỗ trợ `--location:all`, `--location:business`, `--location:unit`, `--dry-run`.
- Seed tạo `BusinessLocation`, admin role `ADMIN_LOC` và `UnitConfig`.
- Validate unique location, admin email và cặp `businessLocationId + unit`.
- File chính: `backend/prisma/locationSeed.ts`, `backend/prisma/location-seed.json`.

## Giai Đoạn 2 - Role, Scope Và Register Flow

### 2026-07-02 - Role JWT Cố Định Theo BusinessLocation

- Đổi role sang bộ cố định: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`, `CHECKIN`.
- Auth login/middleware trả `businessLocationId` và đọc user mới từ DB.
- Route guard backend/frontend chuyển sang role mới.
- Backoffice lọc tab theo quyền.
- File chính: `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`, `backend/src/routes/users.ts`, `frontend/src/App.tsx`, `frontend/src/pages/Backoffice.tsx`.

### 2026-07-02 - Loại Bỏ StaffRole, Dùng Role Chung Cho StaffPin

- Bỏ enum `StaffRole`.
- `StaffPin.role` dùng enum `Role`.
- Staff PIN chỉ chấp nhận `CHECKIN` hoặc `RECEIVING`.
- Kiosk/staff action chuyển từ alias `SECURITY` sang `CHECKIN`.
- File chính: `backend/prisma/schema.prisma`, `backend/src/routes/staffPins.ts`, `backend/src/routes/checkin.ts`, `backend/src/routes/track.ts`.

### 2026-07-02 - Refactor Backoffice Và Chuyển Tab Nhân Viên Sang User

- Refactor `Backoffice.tsx` thành shell page.
- Thêm `frontend/src/features/backoffice`.
- Tách tab slot, zone, unit, brand, vendor kho tự động, user và nhân viên.
- Tab nhân viên chuyển sang quản lý `User` thật qua `/api/users/location-staff`.
- File chính: `frontend/src/pages/Backoffice.tsx`, `frontend/src/features/backoffice/*`, `backend/src/routes/users.ts`.

### 2026-07-03 - Refactor Register Thành Feature Module

- Refactor `Register.tsx` thành shell page.
- Thêm `frontend/src/features/register`.
- Tách hook form, API helper, component, 4 step wizard và success screen.
- Giữ nguyên API contract hiện có.
- File chính: `frontend/src/pages/Register.tsx`, `frontend/src/features/register/*`.

### 2026-07-03 - Register Availability Theo Slot Thật

- `/api/units/:unit/slots` tính capacity từ tổng `Slot.maxCapacity` của slot active, đúng unit và đúng vehicle type.
- Thêm `/api/units/:unit/vehicle-availability`.
- Register chỉ hiển thị loại xe backend trả về.
- Capacity không còn dựa vào `truckMaxPerSlot`/`motorbikeMaxPerSlot`.
- File chính: `backend/src/routes/units.ts`, `frontend/src/features/register/hooks/useRegisterForm.ts`.

### 2026-07-03 - Siết Rule Chủ Nhật Chỉ Nhận Hàng Tươi Sống

- Frontend chặn ngày Chủ nhật khi unit bật `sundayFreshFoodOnly` và goods type không phải `FRESH_FOOD`.
- Ẩn lựa chọn thời gian khác, disable nút tiếp theo và hiển thị message.
- Backend `/api/deliveries/register` validate lại và trả `422`.
- File chính: `frontend/src/features/register/hooks/useRegisterForm.ts`, `frontend/src/features/register/steps/ScheduleStep.tsx`, `backend/src/routes/deliveries.ts`.

### 2026-07-03 - Register Review Edit Quay Lại Bước 4

- Khi sửa thông tin từ bước review, sau khi bấm tiếp theo sẽ quay thẳng về bước 4.
- Dữ liệu form được giữ nguyên.
- File chính: `frontend/src/features/register/hooks/useRegisterForm.ts`, `frontend/src/features/register/steps/ReviewSubmitStep.tsx`.

### 2026-07-03 - Register Validation Scroll Và Highlight Field Lỗi

- Thêm thứ tự field bắt buộc theo từng bước.
- Khi validate fail, tự scroll tới vùng lỗi đầu tiên.
- Thêm `FieldFrame` và `FieldFeedback` để highlight lỗi bằng viền đỏ dịu.
- File chính: `frontend/src/features/register/hooks/useRegisterForm.ts`, `frontend/src/features/register/components/FieldFrame.tsx`, `frontend/src/features/register/components/FieldFeedback.tsx`.

### 2026-07-03 - Thông Báo Gọi Vào Slot Lặp Liên Tục Trên Track

- Khi delivery chuyển `CALLED`, overlay xanh lá bật âm thanh và rung lặp liên tục.
- Âm thanh/rung chỉ dừng khi người dùng bấm đóng hoặc status đổi khỏi `CALLED`.
- File chính: `frontend/src/pages/Track.tsx`.

### 2026-07-03 - Global Scope Theo businessLocationId Cho Query Vận Hành

- Thêm/siết `enforceScope` và `enforceResourceScope` trên các route vận hành.
- Scope áp dụng cho deliveries, dashboard, slots, zones, units admin routes, devices, audit logs, reports.
- Non-`SUPERADMIN` bị ép theo `req.user.businessLocationId`.
- File chính: `backend/src/middleware/auth.ts`, `backend/src/routes/deliveries.ts`, `backend/src/routes/dashboard.ts`, `backend/src/routes/slots.ts`, `backend/src/routes/zones.ts`, `backend/src/routes/units.ts`, `backend/src/routes/devices.ts`, `backend/src/routes/reports.ts`.

### 2026-07-03 - Mở Rộng Audit Log Cho User/Location/Unit/Zone/Slot

- Ghi audit cho user CRUD/reset password/deactivate.
- Ghi audit cho zone/slot/unit config/time window/goods type/staff PIN.
- Không log password/PIN/secret.
- File chính: `backend/src/routes/users.ts`, `backend/src/routes/zones.ts`, `backend/src/routes/slots.ts`, `backend/src/routes/units.ts`, `backend/src/routes/staffPins.ts`.

### 2026-07-06 - App Config Và Nền Tảng Xác Thực Nâng Cao

- Thêm bảng `app_configs` dạng `key/category/value JSONB`.
- Thêm `face_credentials` và `auth_challenges` cho WebAuthn/passkey.
- Thêm seed app config; mặc định `auth.static_ip.enabled = false` và `auth.face_id.enabled = false`.
- Login kiểm tra static IP và Face ID chỉ khi config bật.
- Thêm API đăng ký/xác thực Face ID/passkey.
- File chính: `backend/prisma/schema.prisma`, `backend/prisma/app-config-seed.json`, `backend/prisma/appConfigSeed.ts`, `backend/src/services/appConfig.ts`, `backend/src/services/staticIpAuth.ts`, `backend/src/services/faceIdAuth.ts`, `backend/src/routes/auth.ts`.

## Ghi Chú Đối Soát Hiện Tại

- `PLAN.md` giai đoạn 2 đã đánh `[COMPLETED]` cho nhiệm vụ 1 đến 7.
- Nhiệm vụ tiếp theo còn mở: refactor kiosk/device terminal theo đúng trách nhiệm `CHECKIN` và `RECEIVING`.
- Tài liệu chi tiết theo từng mảng nằm trong thư mục `docs/`.
