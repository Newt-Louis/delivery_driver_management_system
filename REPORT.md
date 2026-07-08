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
