# Luồng Check-in Chuẩn

## Mục Tiêu

Check-in chuẩn hiện nên đi qua route `/check-in` trên frontend và các endpoint rõ ràng trong `/api/deliveries`.

Role `CHECKIN` chỉ làm nhiệm vụ:

- Tìm lượt đăng ký bằng QR/registration code hoặc biển số.
- Check-in tài xế từ `REGISTERED` sang `WAITING`.

## Frontend

File:

- `frontend/src/pages/CheckIn.tsx`

API đang dùng:

- `PATCH /api/deliveries/check-in-lookup`
- `GET /api/deliveries?status=WAITING`

Chức năng:

- Quét/nhập mã đăng ký.
- Tìm bằng biển số.
- Check-in lượt hợp lệ.
- Xem danh sách xe đang chờ.
- Export CSV danh sách waiting.
- Label/màu đơn vị trên kết quả check-in và danh sách waiting ưu tiên `delivery.unitConfig`; fallback legacy theo `receivingUnit` chỉ dùng cho dữ liệu cũ thiếu `unitConfigId`.

Route:

- `/check-in` trong `frontend/src/App.tsx`.
- Role được vào: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
- `RECEIVING` không được vào `/check-in`.

## Backend

Files:

- `backend/src/routes/deliveries.ts`: controller mỏng cho endpoint `/api/deliveries/*`.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: parse payload check-in lookup và các payload delivery khác.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery/queue và attach call count.
- `backend/src/modules/deliveries/deliveryService.ts`: điều phối check-in lookup, check-in by id, scope/unit-permission, audit, socket emit, track realtime và trigger auto-assign.
- `backend/src/services/checkInDelivery.ts`
- `backend/src/services/ticketSequence.ts`

API:

- `PATCH /api/deliveries/check-in-lookup`
  - Tìm delivery bằng `registrationCode` hoặc `vehiclePlate`.
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
  - Check delivery đúng ngày giao.
  - Gọi `checkInDelivery()`.
  - Emit realtime và trigger auto-assign.
- `PATCH /api/deliveries/:id/check-in`
  - Check-in bằng id.
  - Role như trên.

Service:

- `checkInDelivery()`
  - Lock row delivery.
  - Nếu đã `WAITING`, trả lại kết quả idempotent, không cấp lại ticket.
  - Nếu `REGISTERED`, chuyển sang `WAITING`, set `checkinTime`, cấp `ticketNumber`.
  - Ghi event `CHECKED_IN` trong `delivery_history_events`.
- `reserveTicketNumber()`
  - Cấp ticket atomic theo ngày VN + receiving unit + vehicle type.
  - Ticket code vẫn format từ snapshot `receivingUnit + vehicleType + ticketNumber` để tương thích số thẻ đã cấp.

## Scope Unit Động

Delivery mới từ `/register` có `unitConfigId`. Với các delivery này, check-in dùng `unitConfigId` làm khóa scope chính:

- `getScopeForDelivery()` ưu tiên `assignedSlot`, sau đó tới `delivery.unitConfigId`, cuối cùng mới fallback legacy theo default location + `receivingUnit`.
- `ensureDeliveryAccess()` kiểm `businessLocationId` từ scope đã resolve.
- `assertUnitPermission()` so quyền thao tác bằng `UserUnitPermission.unitConfigId` khi delivery có `unitConfigId`.
- `GET /api/deliveries?status=WAITING` lọc danh sách theo các `unitConfigId` trong scope hiện tại; nếu scope không resolve ra unit nào thì trả danh sách rỗng.
- Response check-in và waiting list include `unitConfig` rút gọn gồm `id`, `unit`, `businessLocationId`, `displayName`, `shortName`, `icon`, `logoUrl`, `primaryColor` để frontend không phải hardcode label/brand unit.

Fallback legacy:

- Nếu delivery cũ chưa có `unitConfigId`, backend vẫn có thể fallback theo `receivingUnit` trong `BusinessLocation` mặc định để tránh làm chết dữ liệu cũ.
- Đây không phải hướng runtime chính cho dữ liệu mới.

## Quyền Hiện Tại

Đúng:

- `CHECKIN` không được call/start/complete/cancel delivery trong `/api/deliveries`.
- `RECEIVING` không được vào `/check-in` trên frontend.
- `CHECKIN` chỉ được check-in delivery thuộc unit config đã được gán trong `user_unit_permissions`.
- Multi-unit allowlist cho `CHECKIN`, `RECEIVING`, `ADMIN_LOC`, `ADMIN_OPE` được quản lý bằng `UserUnitPermission` theo `unitConfigId`.
- Audit check-in hiện ghi actor từ user đang đăng nhập qua `userActor(req.user)`.
