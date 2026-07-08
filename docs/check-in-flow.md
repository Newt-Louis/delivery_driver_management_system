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

Route:

- `/check-in` trong `frontend/src/App.tsx`.
- Role được vào: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
- `RECEIVING` không được vào `/check-in`.

## Backend

File:

- `backend/src/routes/deliveries.ts`
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
- `reserveTicketNumber()`
  - Cấp ticket atomic theo ngày VN + receiving unit + vehicle type.

## Quyền Hiện Tại

Đúng:

- `CHECKIN` không được call/start/complete/cancel delivery trong `/api/deliveries`.
- `RECEIVING` không được vào `/check-in` trên frontend.
- `CHECKIN` chỉ được check-in delivery thuộc unit đã được gán trong `user_unit_permissions`.
- Multi-unit allowlist cho `CHECKIN` và `RECEIVING` được quản lý trong Backoffice tab Nhân Viên.

Lưu ý:

- Audit của `check-in-lookup` có chỗ dùng `systemActor('public-check-in-route')`, cần đổi thành user actor nếu cần truy vết đúng nhân sự.
