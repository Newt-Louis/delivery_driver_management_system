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
- File chính: `backend/src/services/checkInDelivery.ts`, `backend/src/services/ticketSequence.ts`, `backend/src/routes/deliveries.ts`, `backend/src/routes/track.ts`.

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

### 2026-06-30 - Device Registry Cho Thiết Bị Vận Hành

- Thêm model `Device` và route CRUD `/api/devices`.
- Thiết bị được gắn với `businessLocationId`, có `deviceType`, `deviceSecretHash`, `isActive`, `lastSeenAt`.
- Device API không trả `deviceSecretHash`.
- File chính: `backend/src/routes/devices.ts`, `backend/prisma/schema.prisma`.

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
- Áp dụng cho login, track staff action, register, push subscribe, track search và slot availability.
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
- Staff action chuyển từ alias `SECURITY` sang `CHECKIN`.
- File chính: `backend/prisma/schema.prisma`, `backend/src/routes/staffPins.ts`, `backend/src/routes/track.ts`.

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

### 2026-07-06 - Loại Bỏ Kiosk Terminal Khỏi Luồng Vận Hành

- Xóa page React `frontend/src/pages/Kiosk.tsx`.
- Xóa route React `/kiosk`, link navbar và shortcut PWA liên quan.
- Xóa backend route `/api/checkin` và file `backend/src/routes/checkin.ts`.
- Dọn helper chỉ phục vụ kiosk terminal: `terminalAuthLimiter`, `deviceStaffActor`, socket room `kiosk`.
- Gỡ cấu hình hình nền kiosk khỏi tab Brand trong Backoffice.
- Đổi `DeviceType.KIOSK` thành `DeviceType.FIXED_DEVICE`, thêm migration rename enum và bỏ cột `business_locations.kiosk_bg_url`.
- Đổi tên certificate tự ký frontend Docker từ `kiosk.*` sang `frontend.*`.
- Giữ `/api/deliveries/check-in-lookup` làm luồng check-in chuẩn cho trang `/check-in`.
- Giữ `/api/deliveries/:id/check-in` để dùng cho màn hình danh sách/bấm check-in trực tiếp sau này.
- Giữ CRUD `/api/devices` cho `SUPERADMIN` và `ADMIN_LOC`.
- Ghi chú: `staff_pins` hiện là bảng dự phòng, không còn route kiosk terminal sử dụng.
- Đã kiểm tra bằng `npx prisma format`, `npx prisma validate`, `npx prisma generate`, `npm run build` trong `backend`, `npm run build` trong `frontend`, `git diff --check`.
- File chính: `frontend/src/App.tsx`, `frontend/src/components/Navbar.tsx`, `frontend/public/manifest.json`, `backend/src/index.ts`, `backend/src/socket/index.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/services/auditLog.ts`, `backend/prisma/schema.prisma`.

## Ghi Chú Đối Soát Hiện Tại

- `PLAN.md` giai đoạn 2 đã đánh `[COMPLETED]` cho nhiệm vụ 1 đến 8.
- Tài liệu chi tiết theo từng mảng nằm trong thư mục `docs/`.

## Giai Đoạn 3 - Scheduler Và Hệ Thống Lịch Sử

### 2026-07-07 - Lightweight Modular Monolith Cho History/Scheduler

- Tách mẫu kiến trúc backend nhẹ theo module cho `history` và `scheduler`, chưa refactor lan sang các module khác.
- Thêm schema/migration cho `delivery_history`, `delivery_history_events`, `scheduler_job_histories`, `DeliveryHistoryFinalStatus`, `DeliveryHistoryEventType`, `SchedulerJobStatus`, `SchedulerJobTrigger`, `DeliveryStatus.INCOMPLETED` và `delivery_registrations.cancel_reason`.
- Thay `CallLog` bằng event timeline trong `delivery_history_events`; call count được tính từ event gọi xe.
- Loại bỏ model/route/code runtime `StaffPin` và `/api/staff-pins`; route track action dùng staff PIN cũ đã bị gỡ.
- Register/check-in/manual call/auto assign/start receiving/complete/cancel ghi event timeline.
- Cancel API bắt buộc có reason; Dashboard mở modal nhập lý do hủy.
- Scheduler mới chạy job 23:59 theo `Asia/Ho_Chi_Minh` để archive `REGISTERED` no-show và `RECEIVING`/`AUTO_WAREHOUSE_RECEIVING` incomplete; job 120 phút archive `CANCELLED` có reason.
- Reports delivery history đọc từ `delivery_history`; double-click một dòng lịch sử mở modal timeline từ `delivery_history_events`.
- File chính: `backend/src/modules/history/*`, `backend/src/modules/scheduler/*`, `backend/prisma/schema.prisma`, migration `20260707090000_add_delivery_history_scheduler`, `backend/src/routes/deliveries.ts`, `backend/src/routes/reports.ts`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/Reports.tsx`.
- Đã apply migration bằng `npm run db:migrate`.
- Đã kiểm tra: `npx prisma format`, `npx prisma validate`, `npx prisma generate`, `npm run build` trong `backend`, `npm run build` trong `frontend`, `npm run test:concurrency`.

### 2026-07-07 - Redis Session Và JWT Cookie Auth

- Thêm Redis service `redis:7-alpine` trong `docker-compose.yml`, container `mall_redis`, port `6379`, volume `./data/redis:/data`, healthcheck và `REDIS_URL`.
- Backend dùng Redis để lưu session đăng nhập theo `sid`; JWT vẫn gửi qua `Authorization: Bearer`, nhưng middleware phải verify JWT + kiểm tra Redis session + đọc user mới từ DB.
- Thêm API `/api/auth/me`, `/api/auth/renew`, `/api/auth/logout`; login trả token, user, expiry và session metadata.
- Thêm phát hiện đăng nhập ở thiết bị khác bằng Redis session; login trả `409 ActiveSessionExists`, client có thể gọi lại với `force: true` để revoke phiên cũ.
- Thêm config `auth.session` trong `app_configs` để cấu hình `tokenTtlMinutes`, `renewGraceMinutes`, `singleSessionPerUser`.
- Frontend web lưu JWT vào cookie `dqm_token`, không lưu `token` hoặc `user` mới vào `localStorage`; user state được khôi phục qua `/api/auth/me`.
- Axios interceptor đọc token từ cookie, tự gọi `/api/auth/renew` một lần khi token hết hạn, rồi retry request cũ.
- Socket.IO giữ public rooms cho track/waiting screen; dashboard/docks room phải gửi token hợp lệ khi `realtime:join`.
- Cập nhật tài liệu `docs/auth-role-scope.md` theo workflow login/conflict/renew/logout và contract cho web/mobile/PDA/API consumer.
- File chính: `backend/src/services/authSession.ts`, `backend/src/services/redis.ts`, `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`, `backend/src/socket/index.ts`, `backend/src/services/appConfig.ts`, `backend/prisma/app-config-seed.json`, `frontend/src/lib/authCookies.ts`, `frontend/src/lib/api.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/pages/Login.tsx`, `frontend/src/context/SocketContext.tsx`, `docker-compose.yml`.
- Đã chạy `npm run db:seed_app_config` để upsert `auth.session`.
- Đã kiểm tra: `npm run build` trong `backend`, `npm run build` trong `frontend`.

### 2026-07-08 - Phân Quyền Nhiều Unit Cho CHECKIN/RECEIVING

- Thêm bảng `user_unit_permissions` để gán nhiều `UnitConfig` cho một user và backfill từ `User.unit` hiện có.
- Giữ `User.unit` như unit chính/legacy, nhưng quyền thao tác thật của `CHECKIN` và `RECEIVING` lấy từ `unitPermissions`.
- Thêm service `unitPermission` có cache in-memory, replace permission và invalidate cache khi cập nhật user.
- API user cấp `SUPERADMIN` và API staff cấp `ADMIN_LOC` nhận `unitConfigIds`, validate tất cả unit phải thuộc đúng `businessLocationId`.
- Backend enforce unit permission cho check-in, manual call, auto-dispatch, start receiving, complete và cancel với role hiện trường.
- Staff Users tab trong Backoffice chuyển sang chọn nhiều đơn vị cho `CHECKIN`/`RECEIVING`, hiển thị chip unit và filter theo danh sách permission.
- Cập nhật tài liệu `docs/multi-unit-permissions.md`.
- File chính: `backend/prisma/schema.prisma`, migration `20260708090000_add_user_unit_permissions`, `backend/src/services/unitPermission.ts`, `backend/src/routes/users.ts`, `backend/src/routes/deliveries.ts`, `frontend/src/features/backoffice/tabs/StaffUsersTab.tsx`, `frontend/src/features/backoffice/api.ts`, `frontend/src/features/backoffice/types.ts`, `frontend/src/lib/types.ts`.
- Đã apply migration bằng `npx prisma migrate deploy`.
- Đã kiểm tra: `npx prisma format`, `npx prisma validate`, `npx prisma generate`, `npm run build` trong `backend`, `npm run build` trong `frontend`.

### 2026-07-08 - Điều Chỉnh UI Unit Permission Và Icon UnitConfig

- Điều chỉnh tab Nhân Viên: tạo mới `CHECKIN`/`RECEIVING` chỉ chọn một unit chính; khi edit mới được chọn nhiều unit permission.
- UI multi-unit chỉ áp dụng cho `CHECKIN` và `RECEIVING`; role khác như `ADMIN_OPE` không cần chọn unit.
- Tab Nhân Viên lấy label/icon unit từ `/api/units/configs`, không dùng hardcode `UNIT_META_U` cho chọn và hiển thị permission.
- Thêm cột nullable `unit_configs.icon`, migration `20260708103000_add_unit_config_icon`.
- API `/api/units/configs`, `/api/units/:unit/config`, `/api/brand` trả/nhận `icon`; tab Thương hiệu có ô cấu hình icon cho từng unit.
- Register, ticket thành công và waiting screen ưu tiên icon từ database nếu có.
- Cập nhật `docs/multi-unit-permissions.md` và `docs/check-in-flow.md`.
- File chính: `backend/prisma/schema.prisma`, `backend/src/routes/units.ts`, `backend/src/routes/brand.ts`, `backend/src/routes/users.ts`, `backend/src/services/unitPermission.ts`, `frontend/src/features/backoffice/tabs/StaffUsersTab.tsx`, `frontend/src/features/backoffice/tabs/BrandTab.tsx`, `frontend/src/context/BrandingContext.tsx`, `frontend/src/lib/types.ts`.
- Đã apply migration bằng `npx prisma migrate deploy`.
- Đã kiểm tra: `npx prisma format`, `npx prisma validate`, `npx prisma generate`, `npm run build` trong `backend`, `npm run build` trong `frontend`.

### 2026-07-08 - Redis Cache Cho Auth User, Unit Permission Và App Config

- Rà soát luồng `CHECKIN`/`RECEIVING`: các thao tác check-in lookup, check-in by id, manual call, auto-dispatch, start receiving, complete và cancel đều đi qua helper kiểm tra `user_unit_permissions`.
- Chuyển cache unit permission từ in-memory `Map` sang Redis key `auth:user:{userId}:unit-permissions`, cache miss mới query DB.
- Thêm Redis cache user profile an toàn tại `auth:user:{userId}:profile`; auth middleware đọc session Redis rồi lấy user từ Redis/DB fallback, không đọc DB trên mọi request nữa.
- Khi ADMIN_LOC/SUPERADMIN create/update/reset password/deactivate/delete user, backend refresh hoặc xóa Redis cache đúng user id; deactivate/delete cũng revoke session.
- Thêm cache `app_configs` theo key `app-config:{key}` và helper `upsertAppConfigValue()`, `refreshAppConfigCache()`, `invalidateAppConfigCache()`.
- Thêm devDependency `redis-commander` và script `npm run redis:ui` để xem Redis trên trình duyệt tại `http://localhost:8081` bằng tài khoản dev/dev, chạy read-only.
- Cập nhật tài liệu `docs/auth-role-scope.md`, thêm `docs/redis-cache-debug.md`.
- File chính: `backend/src/services/authSession.ts`, `backend/src/services/unitPermission.ts`, `backend/src/services/appConfig.ts`, `backend/src/routes/users.ts`, `backend/package.json`, `backend/package-lock.json`.
- Đã kiểm tra: `npm run build` trong `backend`, `npm run redis:ui -- --test`.
- Lưu ý: `npm install --save-dev redis-commander` báo audit hiện có 33 vulnerabilities trong dependency tree dev/tooling; chưa chạy `npm audit fix` vì có thể gây thay đổi ngoài phạm vi.

### 2026-07-08 - Redis Session Architecture: TTL Removal + Socket.IO Ping/Pong Cleanup

- **Mục tiêu:** Chuyển Redis session từ TTL-based sang event-based. Session không tự hết hạn; chỉ xóa khi Socket.IO detect user mất kết nối (5 lần ping không nhận pong = 75 phút). JWT cookie còn hạn = user luôn được tự động đăng nhập lại qua `/me`.
- **Backend — authSession.ts:**
  - Bỏ TTL khỏi `writeSession()`: `redis.set(key, data)` không dùng `EX`. Session chỉ bị xóa bởi logout/revoke/Socket.IO cleanup.
  - Bỏ TTL khỏi `writeAuthUserCache()`: profile cache tồn tại vô hạn, chỉ invalidate khi admin thay đổi.
  - Mở rộng `SafeAuthUser` thành `FullAuthSession`: thêm `ip`, `deviceId`, `deviceName`, `userAgent`, `sid`, `createdAt`, `lastSeenAt`. `writeAuthUserCache()` giờ lưu full session data.
  - Sửa `resolveActiveSessionAndUser()`: khi session Redis không tìm thấy nhưng JWT hợp lệ → tự tạo session mới từ JWT payload + DB user → trả user + session mới. User không bao giờ thấy trang login trừ khi JWT cookie hết hạn.
  - Xóa `authUserCacheSeconds()` (không còn cần).
- **Backend — unitPermission.ts:**
  - Bỏ TTL khỏi `writeUserUnitPermissionCache()`: permission cache tồn tại vô hạn.
  - Xóa `unitPermissionCacheSeconds()` (không còn cần).
- **Backend — socket/index.ts:**
  - Cấu hình Socket.IO: `pingInterval: 15 phút`, `pingTimeout: 20s`.
  - Thêm `disconnectedSockets: Map<socketId, { userId, timer, missedPongs }>` để track disconnect.
  - Khi socket disconnect → start timer 15 phút. Mỗi lần timer fire → tăng `missedPongs`. Nếu >= 5 → gọi `cleanupUserRedisData()` xóa session + profile + permission cache.
  - Khi socket reconnect lại (cùng userId) → cancel timer, xóa khỏi map.
  - Export `cleanupUserRedisData(userId)` để dùng trong cả socket handler và safety job.
  - Lưu `userId` vào `socket.data` khi `realtime:join` với token hợp lệ.
- **Frontend — SocketContext.tsx:**
  - Thêm listener `socket.on('reconnect')` → tự动 emit `realtime:join` lại với token mới nhất để vào lại dashboard/docks room.
- **Kiến trúc hoạt động:**
  - Login → session Redis không TTL, profile cache không TTL, permission cache không TTL.
  - User hoạt động bình thường → session luôn sẵn sàng, không bao giờ hết hạn.
  - User đóng browser → Socket.IO disconnect → 75 phút không reconnect → cleanup Redis → giải phóng RAM.
  - User mở lại app → JWT cookie còn hạn → `/me` tự tạo session mới → không thấy trang login.
- File chính: `backend/src/services/authSession.ts`, `backend/src/services/unitPermission.ts`, `backend/src/socket/index.ts`, `frontend/src/context/SocketContext.tsx`.
- Đã kiểm tra: `npm run build` trong `backend`, `npm run build` trong `frontend`.

### 2026-07-08 - Trang Lịch Sử (`/histories`) Và API Histories

- **Backend — route mới `backend/src/routes/histories.ts`:**
  - `GET /api/histories/delivery` — phân trang `delivery_history` với sort, filter, search. Scope theo `businessLocationId` (SUPERADMIN không bị scope). Hỗ trợ sort ASC/DESC trên 12 trường.
  - `GET /api/histories/delivery/:id/events` — lấy `delivery_history_events` theo `deliveryHistoryId`, scope đúng `businessLocationId`.
  - `GET /api/histories/audit` — phân trang `audit_logs` với sort, filter, search. Scope theo `businessLocationId`.
  - Middleware: `authenticate`, `enforceScope`, `requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE')`.
  - Đã mount trong `backend/src/index.ts` tại `/api/histories`.
- **Frontend — feature module `frontend/src/features/histories/`:**
  - `types.ts`: types cho `DeliveryHistoryItem`, `AuditLogItem`, `PaginatedResponse<T>`, sort field, column config.
  - `constants.ts`: labels tiếng Việt cho status/goods/vehicle/unit/event, column configs mặc định, storage keys.
  - `api.ts`: API helpers `getDeliveryHistory()`, `getDeliveryHistoryEvents()`, `getAuditLogs()`.
  - `hooks/useDeliveryHistory.ts`: React Query hook quản lý state page/sort/filter/search.
  - `hooks/useAuditLogs.ts`: tương tự cho audit logs.
  - `components/PlaceholderTab.tsx`: "Tính năng đang phát triển".
  - `components/ColumnToggle.tsx`: dropdown bật/tắt cột, lưu localStorage.
  - `components/DeliveryTable.tsx`: bảng phân trang với sort header, double-click → modal timeline.
  - `components/AuditTable.tsx`: bảng phân trang, double-click → modal JSON chi tiết.
  - `components/TimelineModal.tsx`: modal hiển thị timeline từ `delivery_history_events`.
  - `components/AuditDetailModal.tsx`: modal JSON before/after/metadata.
- **Frontend — page `frontend/src/pages/Histories.tsx`:**
  - Shell page với 3 tab: Truy cập (placeholder), Giao/Nhận (delivery history), Audit.
  - Tab Giao/Nhận: filter theo status/unit/goods/vehicle/ngày, search text, column toggle, sort, double-click modal.
  - Tab Audit: filter theo actorType/action/targetType/ngày, search text, column toggle, sort, double-click modal.
- **Route & Navigation:**
  - Route `/histories` với `ProtectedRoute roles={['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE']}` trong `App.tsx`.
  - Nav item "Lịch sử" (`📜`) nằm dưới "Báo cáo" trong nhóm "Phân tích" tại `Navbar.tsx`.
- File chính: `backend/src/routes/histories.ts`, `backend/src/index.ts`, `frontend/src/features/histories/*`, `frontend/src/pages/Histories.tsx`, `frontend/src/App.tsx`, `frontend/src/components/Navbar.tsx`.
- Đã kiểm tra: `npm run build` trong `backend`, `npm run build` trong `frontend`.

### 2026-07-08 - Thêm unitPermissions Vào Login/Me Response

- Thêm import `getUserUnitPermissions` và `roleRequiresUnitPermission` vào `backend/src/routes/auth.ts`.
- `POST /api/auth/login`: trả thêm `unitPermissions` (mảng `[{id, unit, displayName, icon, businessLocationId}]`) khi role là CHECKIN/RECEIVING.
- `GET /api/auth/me`: tương tự, để khi mở lại app cũng có data permission.
- `POST /api/auth/face-id/authenticate/verify`: face-id login cũng trả permission.
- Role khác CHECKIN/RECEIVING → `unitPermissions` là `undefined`.
- File chính: `backend/src/routes/auth.ts`.
- Đã kiểm tra: `npm run build` trong `backend`.

### 2026-07-08 - Rà soát và Sửa Lỗi Scheduler

- **Vấn đề:** Scheduler `archive-cancelled-deliveries` (2 tiếng/lần) không hoạt động sau hơn 2 tiếng chạy. Timer reference leak trong mảng `timers`, không có guard chống chạy trùng, không có heartbeat logging.
- **Scheduler — `backend/src/modules/scheduler/schedulerService.ts`:**
  - Rewrite toàn bộ timer management: mỗi job type có `JobState` object `{ isRunning, timer, lastRunAt, lastResult, nextRunAt }` thay vì array `ManagedTimer[]`.
  - Thêm guard `isRunning` per job: nếu job đang chạy → skip lần tiếp theo, log warning, schedule lại.
  - Timer reference quản lý bằng `clearTimeout` trước khi schedule mới → không leak.
  - Thêm heartbeat log mỗi 30 phút: `[scheduler] heartbeat at ...` để xác nhận scheduler đang sống.
  - Thêm startup log: `[scheduler] Starting operational scheduler (Asia/Ho_Chi_Minh)`.
  - Export `getSchedulerStatus()` trả về next run time, isRunning, last run info cho health endpoint.
- **Index — `backend/src/index.ts`:**
  - Capture scheduler return value: `const scheduler = startOperationalScheduler()`.
  - Thêm `GET /health/scheduler` endpoint trả JSON: `{ status, scheduler: { dailyClose, cancelledArchive } }`.
  - Thêm graceful shutdown handler: listen `SIGTERM`/`SIGINT` → `scheduler.stop()`, `server.close()`, `prisma.$disconnect()`. Force exit sau 10s nếu graceful hang.
- File chính: `backend/src/modules/scheduler/schedulerService.ts`, `backend/src/index.ts`.
- Đã kiểm tra: `npm run build` trong `backend`.

## Giai Đoạn 4 - Dashboard, Mượn Slot, Bảng Tình Trạng Vị Trí Và Tối Ưu API

Kế hoạch: `PLAN.md` (việc 0 → 6). Thay đổi hợp đồng API ghi ở `docs/api/CHANGELOG.md`.

### 2026-11-17 - Việc 0: Chặn Lộ Dữ Liệu Trên Kênh Public

- Thêm allow-list `backend/src/domain/publicDeliveryView.ts` (`toPublicDelivery`, `toPublicQueue`, `toPublicSlot`, `toPublicSlots`).
- `GET /api/deliveries/queue` (public) trả bản rút gọn: bỏ `registrationCode`, tên/SĐT tài xế, NCC, PO, note và các cột không cần cho màn hình chờ.
- `emitQueueUpdated()`/`emitSlotUpdated()` trong `backend/src/socket/index.ts` tự chiếu payload qua allow-list, nên mọi điểm emit (lifecycle, auto-assign, scheduler, seeding, slot service) đều được che, không phải sửa từng nơi. Lý do: phòng `business-location:{id}`/`unit-config:{id}` join được không cần đăng nhập.
- `GET /api/dashboard/dispatch`: thay `unitConfig: true` bằng `select` an toàn, không còn trả `vendorApiKey`/`poApiKey`.
- `superadminService`: 4 chỗ `include: { unitConfig: true }` (cập nhật/vô hiệu vendor kho tự động, cập nhật/xoá cấu hình thời gian nhận hàng) làm API key của `UnitConfig` bị ghi vào `before` của audit log. Đổi sang chỉ lấy `businessLocationId`.
- Frontend: thêm type `PublicQueueDelivery` (`lib/types.ts`); waiting screen dùng type này. Sắp xếp phụ đổi từ `registrationCode` sang `id`; ô số thứ tự khi chưa có số thẻ hiện `—` thay vì mã đăng ký.
- Đã kiểm tra: `npm run build` ở `backend` và `frontend`. Gọi thật `GET /api/deliveries/queue` trên dev server: còn 16 trường allow-list, không còn trường cá nhân.
- Chưa kiểm tra trực tiếp: payload socket `queue_updated`/`slot_updated` (cần phát sinh thao tác thật). Logic dùng chung hàm chiếu với REST queue đã kiểm tra.
- Còn tồn tại, ngoài phạm vi việc 0: gọi `GET /api/deliveries/queue` **không kèm** `businessLocationId` trả hàng chờ của mọi khu vực (dữ liệu đã rút gọn). Trang legacy `DriverView` (không có route) đọc `vendorName` từ queue nên sẽ hiện trống.

### 2026-11-17 - Việc 1: Click Dòng Để Xem Chi Tiết Thay Cho Nút "Xem"

- Thêm `frontend/src/features/dashboard/components/DeliveryDetailPanel.tsx`: nội dung chi tiết chỉ đọc (Descriptions + timeline), tự gọi `GET /api/deliveries/:id` khi được mở, không có nút thao tác.
- `QueueTable.tsx`: desktop dùng `expandable` của Ant Table (`expandRowByClick`, mỗi lần một dòng, dòng đang mở tô nền `colorPrimaryBg`, con trỏ dạng tay khi hover); mobile dùng `Collapse accordion` với cùng panel, kèm thời gian chờ và hàng nút thao tác bên dưới. Bỏ nút "Xem".
- Bỏ prop `onView` ở `QueueTable`/`UnitTabView`/`AllTabView`, bỏ state `viewId`/`closeViewModal` ở `useDashboard`, xoá `DeliveryDetailModal.tsx` (không còn chỗ dùng).
- `useDashboard.invalidateAll()` invalidate thêm query `['delivery']` để panel đang mở tự cập nhật theo socket.
- Đã kiểm tra: `npm run build` ở `frontend`; gọi thật `GET /api/deliveries/:id` (200, có `historyEvents`, `callCount`, `unitConfig`).
- Chưa kiểm tra: giao diện trên trình duyệt. Headless Chromium trong WSL thiếu thư viện hệ thống `libasound.so.2` (cần `sudo apt-get install libasound2t64`).

### 2026-11-17 - Việc 2: "Gọi Lại" Chỉ Phát Lại Thông Báo

- `useDashboard.doRecall(delivery)`: gọi `PATCH /api/deliveries/:id/call` với slot hiện tại của xe, toast "Đã phát lại thông báo cho xe …", không mở `CallModal`. Nút "Gọi lại" có `loading` riêng (`actionLoading = id + 'recall'`), các nút khác của bảng bị khoá trong lúc request chạy như các thao tác hiện có.
- Truyền `onRecall` qua `Dashboard` → `UnitTabView`/`AllTabView` → `QueueTable`.
- Backend không đổi logic: `manualCallDelivery()` đã xử lý gọi lại (`outcome: 'recalled'`, event `RECALLED`, socket, web push).
- Thêm `TODO(anti-spam)` ở `frontend/src/features/dashboard/hooks/useDashboard.ts` (`doRecall`) và `backend/src/modules/deliveries/deliveryService.ts` (`callDelivery`).
- Ghi nhận (không sửa): job `auto-cancel-called-no-show` tính thời hạn từ event gọi gần nhất, gồm `RECALLED`, nên mỗi lần "Gọi lại" kéo dài thời hạn tự hủy. Tag "Chưa vào" và `noShowRisk` vẫn tính từ `calledTime`.
- Đã kiểm tra: `npm run build` ở `backend` và `frontend`.
- Chưa kiểm tra: bấm "Gọi lại" thật trên dev server (backend dev server đã dừng tại thời điểm kiểm tra).

### 2026-11-17 - Việc 3: "Mượn Slot"

- Backend: thêm `GET /api/deliveries/:id/borrowable-slots` (`deliveryService.getBorrowableSlots`). Chỉ xe `WAITING`; trả slot cùng loại xe, cùng `BusinessLocation`, đang hoạt động và không `MAINTENANCE`/`RESERVED`; nhóm `sameUnit` (còn chỗ) và `otherUnits` (trống hoàn toàn) theo đúng luật `manualCallDelivery()`. Chỉ trả trường hiển thị.
- Backend: `callDelivery` bỏ `assertCanOperateUnit` trên slot đích. Vẫn kiểm tra quyền trên đơn vị của xe, cùng khu vực, sức chứa và luật slot đơn vị khác phải trống.
- 3d: `slotService.updateSlot` gọi `triggerAutoAssign` ngay khi `autoAssign` chuyển từ tắt sang bật. Đã xác minh tắt có hiệu lực ngay (cờ đọc lại dưới khoá `FOR UPDATE`, không cache).
- 3e: audit `slot.update` ghi thêm before/after của `autoAssign`, `maxCapacity`.
- Frontend: nút "Gọi vào vị trí" thành "Mượn slot" (chỉ xe `WAITING`). `CallModal` lấy dữ liệu từ endpoint mới, hai nhóm "Cùng đơn vị"/"Khác đơn vị", báo khi slot gợi ý không còn trống. Bỏ prop `slots`, `allSlots` và helper `getDispatchSlots`. Socket invalidate thêm `['borrowable-slots']`.
- 3c không áp dụng: enum `VehicleType` trong `schema.prisma` chỉ có `TRUCK`, `MOTORBIKE` (AGENTS.md còn ghi `OTHER`).
- Sửa phụ: bỏ `autoWarehouseOnly` khỏi allow-list `publicDeliveryView.ts` và CHANGELOG việc 0, vì model `Slot` không có cột này (AGENTS.md còn nhắc tới).
- Đã kiểm tra: `npm run build` ở `backend` và `frontend`. Gọi thật endpoint trên dev server: xe tải EMART nhận E2–E5 (cùng đơn vị), M1/M2 (MALL), T2 (THISKY); E1 (đầy) và T1 (đang có xe EMART mượn) bị loại đúng; xe máy chỉ nhận slot xe máy; xe `CALLED` nhận 409.
- Chưa kiểm tra: giao diện popup trên trình duyệt; trường hợp tài khoản chỉ có quyền một đơn vị (tài khoản test đều có cả ba đơn vị); bật lại `autoAssign` trên dev (sẽ gọi xe thật).

### 2026-11-17 - Bỏ Timeline Khỏi Panel Chi Tiết Dashboard

- Người dùng yêu cầu bỏ hẳn timeline: hiển thị lặp (một dòng đổi trạng thái và một dòng có tên tài khoản cho cùng sự kiện) và không cần thiết.
- `DeliveryDetailPanel` chỉ còn bảng thông tin. Xoá `getDeliveryTimeline` (dashboard utils), `EVENT_LABEL`/`formatEventLabel` của dashboard (trang Lịch sử có bản riêng), trường `historyEvents` trong type `DeliveryRegistration`.
- Backend `getDeliveryDetails` (`GET /api/deliveries/:id`) bỏ query `listDeliveryHistoryEvents`; response không còn `historyEvents` (đã ghi BREAKING trong `docs/api/CHANGELOG.md`).
- Đã kiểm tra: build `backend` + `frontend`; gọi thật `GET /api/deliveries/:id`: 200, không có `historyEvents`, vẫn có `callCount`.

### 2026-11-17 - Việc 4: Hiển Thị Xe Mượn Slot Ở Cả Hai Đơn Vị (Dashboard)

- Bỏ dòng "Ngày giao" khỏi panel chi tiết (hệ thống vận hành trong ngày); xoá helper `formatDateOnly` không còn dùng.
- `GET /api/dashboard/dispatch`: include `unitConfig` của xe; mỗi dòng có `slotBorrow`; mỗi đơn vị có thêm `lentSlotRows` (xe đơn vị khác trong slot của đơn vị này, `isLentSlotRow`, rút gọn qua `toPublicDelivery` + `detailRestricted: true` khi người xem không có quyền trên đơn vị của xe). `active`/badge/stats/alerts/gợi ý AI không tính dòng cho mượn.
- Frontend: helper `getDeliveryUnitConfig()` (không suy đơn vị từ slot của đơn vị khác) dùng cho số thẻ, nhãn đơn vị, CSV, panel, `CallModal`, `UpcomingSection`, `Dashboard`. Tab đơn vị hiển thị `active` + `lentSlotRows` trong cùng bảng; tag vàng ở cột vị trí; nút thao tác của dòng cho mượn disabled; dòng `detailRestricted` không bung chi tiết; tab "Tất cả" mỗi xe một lần; CSV bỏ dòng cho mượn. Sửa ô tìm kiếm không crash khi dòng thiếu `vendorName`/`registrationCode`.
- Sửa lỗi phát hiện khi làm:
  - Realtime: `getScopeForDelivery()` cho xe mượn slot trả `unitConfigIds` cả hai đơn vị; trước đây nhân sự chỉ có quyền đơn vị đi mượn không nhận event (chỉ phát vào phòng đơn vị slot).
  - Auto-assign: thêm `triggerAutoAssignForReleasedSlot()` dùng ở complete/cancel/job auto-cancel; trước đây khi xe mượn slot rời đi, auto-assign chạy với đơn vị của xe + scope slot đơn vị khác nên không gán được, slot cho mượn bị bỏ trống tới sự kiện kế tiếp.
  - Audit `manual_call`/`start_receiving`/`complete`/`cancel`/`auto_cancel_called_no_show` ghi `unitConfigId` theo đơn vị của xe.
- Đã kiểm tra: build `backend` + `frontend`; gọi thật dispatch trên dev: xe EMART "1154" ở "Vị trí T1" (slot THISKY) nằm trong `active` EMART với `unitConfig` EMART + `slotBorrow`, và trong `lentSlotRows` THISKY; thống kê "called" của THISKY không tính dòng này; không có API key trong payload. Đọc code `/docks`, `ZonesTab`, `SlotsTab`: nhóm theo đơn vị slot, không cần sửa.
- Chưa kiểm tra: nhánh `detailRestricted: true` (tài khoản test đều có cả ba đơn vị); giao diện trên trình duyệt; realtime và auto-assign sau hoàn tất xe mượn trên dữ liệu thật (cần thao tác hoàn tất thật).

### 2026-11-18 - Việc 5: Bảng Tình Trạng Vị Trí Ở Waiting Screen

- Backend: endpoint public `GET /api/waiting-screen/board` (`routes/waitingScreen.ts`, mount `/api/waiting-screen`, `publicReadLimiter`, bắt buộc scope). `modules/waitingScreen/waitingBoardService.ts` dựng board theo quy tắc R1 (mỗi chỗ một dòng, trạng thái `EMPTY/CALLED/RECEIVING/FOREIGN/UNAVAILABLE`, `borrowedRows`, `overCapacity`), danh sách chờ 10 xe đầu mỗi loại xe + `waitingTotal`. Không có trường cá nhân.
- Backend: `domain/displayTicketCode.ts` format số thứ tự theo đúng quy tắc của web (prefix `shortName` → `displayName` → unit). `routes/track.ts#formatTicketCode` vẫn dùng mã unit, nên có thể khác (nợ kỹ thuật cũ, chưa sửa).
- Realtime: socket `waiting_board_updated` vào phòng `waiting-screen:{id}`, gom 400 ms theo khu vực (`waitingBoardRealtime.ts`), kích hoạt tự động trong `emitQueueUpdated()`/`emitSlotUpdated()`; thêm `emitToWaitingScreen()` trong `socket/index.ts`.
- Frontend: `useWaitingScreen` dùng board + `waiting_board_updated` (+ tải lại khi `connect`); `BrightUnitPanel` viết lại: khung "Tình trạng vị trí" (cột Vị trí/Số thứ tự/Biển số/Trạng thái, ô trạng thái chỉ tô màu theo token theme, có `aria-label`, chú thích màu, dòng mượn thêm ở cuối, không phân trang) và khung "Đã check-in / Đang chờ" (10 xe đầu mỗi loại, tiêu đề hiện tổng thật, bỏ "Xem thêm"/`IntersectionObserver`). Panel chia theo đơn vị của xe (sửa lỗi xe mượn chỉ hiện ở panel cho mượn). Xoá `bright/VehicleSection.tsx` (không còn dùng). Không đụng `components/dark/*` (5g).
- Tài liệu: quy tắc R1 ghi vào `docs/business-location-unit-zone-slot.md` (tham chiếu từ `operational-screens.md`, `receiving-dashboard-lifecycle.md`); cập nhật `operational-screens.md`, `realtime-socket.md`, `docs/api/CHANGELOG.md`, danh sách route trong `AGENTS.md`.
- Đã kiểm tra: build `backend` + `frontend`. Gọi thật board (PVT): 7,9 KB, 9 ms; thiếu scope trả 400; xe EMART "1154" ở T1 (THISKY) là dòng `FOREIGN` ở THISKY và dòng mượn "T1" ở EMART; slot 5 chỗ ra 5 dòng. Test socket như TV public (không token) + một lần "Gọi lại" thật: `waiting_board_updated` đến đúng 1 lần sau ~400 ms; `queue_updated`, `slot_updated`, `delivery_called` không chứa trường cá nhân (xác nhận luôn phần socket của việc 0).
- Chưa kiểm tra: giao diện trên trình duyệt/TV (headless Chromium thiếu `libasound.so.2`).

### 2026-11-18 - Sửa Waiting Screen Không Cuộn Được Trên Màn Hình Desktop Thấp

- Lỗi người dùng báo: trên desktop không cuộn xuống được khung "Đã check-in / Đang chờ" (kể cả trạng thái rỗng).
- Nguyên nhân (đo bằng Playwright ở 1366×768): `flex-1 min-h-0` nằm trên slider bên trong (`className`) thay vì wrapper `.ant-carousel` (flex item thật của `<main>`), nên Carousel cao 1181px theo nội dung trong khi `<main>` chỉ 708px và `overflow: hidden`; Card body không bao giờ tràn nên không cuộn, phần dưới bị cắt. Ở 1920×1080 nội dung vừa màn hình nên không lộ lỗi.
- Sửa: chuyển `min-[1025px]:min-h-0 min-[1025px]:flex-1` sang `rootClassName` của Carousel (`frontend/src/pages/WaitingScreen.tsx`).
- Đã kiểm tra bằng headless Chromium: 1366×768 Carousel còn 603px, Card body cuộn bằng chuột tới khung chờ và trạng thái "Chưa có xe CHECK-IN"; 1920×1080 vẫn đúng; mobile 412px vẫn cuộn cả trang như cũ.
- Ghi chú môi trường: headless Chromium chạy được nhờ giải nén `libasound2t64` (từ archive Ubuntu noble) vào scratchpad và đặt `LD_LIBRARY_PATH`, không cài vào hệ thống.

### 2026-11-18 - Sửa Tab Đơn Vị Trên Waiting Screen (Điện Thoại)

- Lỗi người dùng báo: trên điện thoại, thanh tab đơn vị hiện nút "..." khi tràn và tab đầu bị mất vài chữ dù đã vuốt hết.
- Nguyên nhân (đo bằng Playwright ở 360px/412px): các rule `.waiting-unit-tabs .ant-tabs-nav-*` trong `index.css` thua style của Ant Design (selector Ant cụ thể hơn), nên (1) `.ant-tabs-nav-operations` vẫn `display: flex` → nút "..." hiện; (2) `.ant-tabs-nav-wrap` vẫn là flex, danh sách tab bị co còn 290px trong khi cần 341px, kết hợp `justify-content: center` nên tab "Emart" tràn sang trái tới -39px, vùng âm không cuộn tới được.
- Sửa (`frontend/src/index.css`): tăng độ cụ thể selector (`.waiting-unit-tabs .ant-tabs .ant-tabs-nav …`), `display:block !important` cho wrap, list `flex: none; width: max-content; margin-inline: auto` (thay cho `justify-content: center`), ẩn `.ant-tabs-nav-operations` và bóng mép `::before/::after` của Ant.
- Đã kiểm tra bằng headless Chromium: 360px và 412px không còn nút "...", tab đầu bắt đầu ở 12px (đủ chữ), vuốt hết sang phải thấy đủ tab cuối; 1366px danh sách vẫn căn giữa.
- Chưa làm: tab đơn vị ở `/dashboard` (`.dashboard-unit-tabs`) dùng mẫu CSS tương tự, chưa kiểm tra có cùng lỗi không.

### 2026-11-18 - Việc 6: Tối Ưu API, Giảm Tải Server, Tài Liệu API Cho App

Quyết định 6c (người dùng chốt 2026-11-18): `queue_updated`/`slot_updated` chỉ gửi tín hiệu, giữ `GET /api/deliveries/queue`.

Đã làm:

- Payload theo bề mặt, thay `include` cả hàng bằng `select` tường minh:
  - `GET /api/dashboard/dispatch`: `DISPATCH_ACTIVE_SELECT`/`DISPATCH_UPCOMING_SELECT`; bỏ mảng `slots` theo đơn vị (không màn hình nào đọc); `unitConfig` theo dòng chỉ gửi trên dòng mượn slot.
  - `GET /api/slots`, `/api/slots/all`: `SLOT_LIST_SELECT` dùng chung (bỏ `code`, `currentDeliveryId`, delivery chỉ còn trường docks dùng); gộp 3 hàm dựng danh sách slot trùng lặp về `slotRepository.listSlotsWithDeliveries`.
  - `GET /api/deliveries/:id`: `findDeliveryDetail` riêng (có `assignedSlot.zone` cho panel); check-in giữ `findDeliveryWithSlot`.
  - `GET /api/track/:code` + `track_updated`: `TRACK_SELECT` theo trường trang track dùng.
  - `GET /api/zones`: `slots[]` bỏ `code`. Socket `delivery_called` bỏ `slotCode`.
- Socket: `emitQueueUpdated(scope)`/`emitSlotUpdated(scope)` chỉ phát tín hiệu `{ businessLocationId, unitConfigIds, at }`; mọi điểm emit (lifecycle, check-in, đăng ký, auto-assign, scheduler, seeding, slot service) không còn tải toàn bộ queue + slot để phát. `emitTrackUpdatesForScope(scope)` thay `emitTrackUpdatesForQueue`: chỉ xét phòng `track:{code}` đang có người nghe, một query lọc mã. Xoá code chết (`getFullQueue`/`getAllSlotsWithDeliveries`/`queueWhereForScope` của autoAssign, `deliveryRepository.getAllSlots`, `toPublicSlot(s)`).
- Frontend: `invalidateQueries(..., { cancelRefetch: false })` ở dashboard và docks; trước đó mỗi thao tác tải dispatch/slots 3 lần (3 event đến cùng lúc, mỗi lần huỷ và gọi lại request). Type `Slot.code`/`currentDeliveryId` thành optional, bỏ `UnitDispatch.slots`.
- Tài liệu API cho app: `docs/api/README.md` (quy ước, lỗi, rate limit, trạng thái, số thẻ), `public.md`, `operations.md`, `realtime.md`; `CHANGELOG.md` thêm hai mục Việc 6 (BREAKING). Cập nhật `docs/realtime-socket.md`, `rate-limit-security.md`, `receiving-dashboard-lifecycle.md`, `docs/README.md`.

Số liệu (khu vực PVT, dev; dữ liệu tải lên bằng seeding 3×100 lượt + check-in hàng loạt → 305 xe đang hoạt động: 295 chờ, 10 đã gọi):

| Hạng mục | Trước | Sau |
|---|---|---|
| Socket mỗi thao tác gọi lại, mỗi client trong khu vực | `queue_updated` 113.913 B + `slot_updated` 5.682 B | 134 B + 134 B |
| Thời gian HTTP một lần gọi lại (TB 5 lần) | 57 ms | 34 ms |
| Dispatch tải lại mỗi thao tác (mỗi dashboard) | 3 lần | 1 lần |
| `GET /api/dashboard/dispatch` (305 xe) | 265 KB (đã cắt trường, còn `unitConfig` mỗi dòng) | 199 KB |
| `GET /api/slots` | 16,8 KB (cách cũ, đo read-only) | 12,4 KB |
| `GET /api/deliveries/queue` / `queue_updated` trước Việc 0 | 471 KB (cách cũ, đo read-only) | 190 KB (REST, rút gọn public) |
| Dữ liệu nhỏ (5 xe): dispatch / slots / detail / track | 17,1 / 11,6 / 1,44 / 1,94 KB | 10,0 / 9,6 / 1,03 / 1,49 KB |

Đã kiểm tra: build `backend` + `frontend`; `npm run test:concurrency` 16 pass, 0 fail (5 skip có sẵn); Playwright: dashboard (bung dòng), docks, track hiển thị đúng, không lỗi API; dashboard/docks tải lại đúng 1 lần sau một tín hiệu; số thẻ/nhãn đơn vị đúng ở tab "Tất cả" và tab đơn vị sau khi bỏ `unitConfig` theo dòng.

Ghi nhận / chưa làm:

- Dữ liệu dev đã thêm: 300 lượt seeding (đã check-in, auto-assign có gọi một số xe), vài event `RECALLED` do đo đạc. Không tự xoá.
- Kế hoạch ban đầu ước "200 xe ≈ 800 query mỗi thao tác" cho track là quá cao: `emitTrackUpdated` đã bỏ qua chuyến không có người nghe từ trước; chi phí chỉ tỉ lệ với số tài xế đang mở trang track.
- Nợ kỹ thuật còn lại: `ticketCode` của `delivery_called` dùng `routes/track.ts#formatTicketCode` (prefix theo mã unit) khác quy tắc hiển thị; `GET /api/deliveries/queue` không kèm `businessLocationId` trả mọi khu vực; trang legacy `DriverView` đọc payload `queue_updated` cũ.

### 2026-11-18 - Việc 7: Đăng Ký Theo Khu Vực Đã Chọn Và Bỏ Trường Mã Công Ty Của API PO

Quyết định người dùng: 7a chưa chọn khu vực → lỗi đỏ dưới ô mã, không toast, không popup; đã chọn → gửi kèm `quick-verify`, backend so khu vực, lệch → 4xx + toast. 7b chặn thêm ở "Hoàn tất đăng ký" (chống sửa payload). 7c nhân sự đăng nhập dùng khu vực tài khoản.

- Backend:
  - `quick-verify`: `businessLocationId` bắt buộc; `verifyQuickRegistrationCode(code, businessLocationId)` so khu vực bên thứ 3 trả về với khu vực đã chọn, lệch → `404 OrderCodeNotFoundInLocation` "Mã PO không tồn tại." / "Mã Thi Công không tồn tại.", không cấp token.
  - `register`: `businessLocationId` bắt buộc (bỏ đường fallback về khu vực hoạt động đầu tiên khi thiếu); đăng ký nhanh mà token khác khu vực gửi lên → cùng lỗi 404.
  - Bỏ hằng số và đoạn ép trường mã công ty mặc định trong request kiểm tra PO (`quickRegistrationService.ts`); test fixture `apiConfigUpdate.test.ts` đổi sang giá trị trung tính.
- Frontend:
  - Hook mới `features/register-manual/hooks/useRegistrationLocation.ts`: khu vực header, hoặc khu vực tài khoản cho nhân sự đăng nhập không phải `SUPERADMIN`.
  - `/register`: lỗi inline dưới ô mã khi chưa chọn khu vực; gửi `businessLocationId` khi kiểm tra mã và khi đăng ký; "Hoàn tất" bật `BusinessLocationSelectorModal` nếu mất khu vực, lệch khu vực thì toast "Mã … không tồn tại." và về bước 1.
  - `/register-manual`: `useRegisterForm` dùng hook trên; "Hoàn tất" bật popup nếu chưa có khu vực; sửa câu hướng dẫn "góc dưới phải" thành vị trí đúng trên thanh tiêu đề.
- Tài liệu: `docs/driver-registration.md`, `docs/app-config-advanced-auth.md` (ví dụ cấu hình và quy tắc PO), `docs/api/public.md`, `docs/api/CHANGELOG.md` (BREAKING cho `quick-verify` và `register`).
- Đã kiểm tra: build `backend` + `frontend`; `npm run test:location-codes` 8/8 (thêm 2 ca lệch khu vực PO/Thi Công); `apiConfigUpdate` + `registrationSupersede` 8/8; API thật: thiếu khu vực → 400 ở cả hai endpoint, có khu vực → gọi được API bên thứ 3; Playwright: chưa chọn khu vực → lỗi inline, 0 request; có khu vực → request mang `businessLocationId`; câu hướng dẫn `/register-manual` đúng. Repo (kể cả `backend/dist`, tài liệu) không còn tên trường đã bỏ.
- Chưa làm được:
  - Chưa chạy trọn luồng mã hợp lệ hôm nay → đăng ký (không có mã PO/Thi Công thật cho ngày hôm nay); nhánh lệch khu vực được kiểm tra bằng unit test.
  - Cấu hình `api.settings.po_verify` trong DB dev vẫn có `payload_keys` chứa tên trường đã bỏ (viết sai chính tả) cùng `ELBELN` (sai chính tả của `EBELN`). Agent không được phép đăng nhập Superadmin để sửa; người dùng cần sửa trong Superadmin → API Config, và làm tương tự trên production.
