# Thiết Bị, Kiosk Terminal Và Kế Hoạch Refactor

## Hiện Trạng

`/kiosk` là route frontend riêng cho thiết bị kiosk/PDA/tablet. Khác với `/check-in`, route này không dùng user JWT login bình thường.

Nó dùng:

- `Device.code`
- `Device.deviceSecretHash`
- `StaffPin.pin`
- Terminal JWT 8 giờ

Files:

- `frontend/src/pages/Kiosk.tsx`
- `backend/src/routes/checkin.ts`
- `backend/src/routes/devices.ts`
- `backend/prisma/schema.prisma` models `Device` và `StaffPin`

API:

- `POST /api/checkin/terminal-auth`
- `POST /api/checkin/scan`
- `GET /api/devices`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`

## Ý Đồ Nghiệp Vụ Ban Đầu

Kiosk/device terminal được thiết kế để tự động hóa scan QR bằng thiết bị cố định:

- Tài xế vào cổng, đưa QR vào máy scan để check-in.
- Tài xế tới khu giao hàng, scan để bắt đầu nhận hàng.
- Giao xong, scan để hoàn tất và giải phóng slot.

Mỗi thiết bị có mã riêng và secret riêng, gắn vào `BusinessLocation`.

## Điểm Sai Hiện Tại

`POST /api/checkin/scan` hiện là unified endpoint xử lý nhiều bước:

- `REGISTERED -> WAITING`
- `CALLED -> RECEIVING`
- `RECEIVING/AUTO_WAREHOUSE_RECEIVING -> COMPLETED`

Trong code có `ROLE_FOR_TERMINAL_SCAN`, nhưng frontend `/kiosk` hiện không gửi role/mode khi terminal auth. Backend set `roleScoped: Boolean(role)`, nên nếu role không được gửi thì `roleScoped = false` và check role theo status bị bỏ qua.

Hệ quả:

- Kiosk đang có thể đi xuyên nhiều bước lifecycle.
- Một terminal dùng PIN check-in có nguy cơ thực hiện cả start/complete receiving.
- Scope hiện chỉ theo `businessLocationId`, chưa có unit-level/device-level permission.

## Luồng Chuẩn Hiện Tại Nên Dùng

Cho đến khi kiosk được refactor, luồng vận hành chuẩn nên đi qua:

- `/check-in` + `/api/deliveries/check-in-lookup` hoặc `/api/deliveries/:id/check-in`.
- `/dashboard` + `/api/deliveries/:id/start-receiving`.
- `/dashboard` + `/api/deliveries/:id/complete`.

## Kế Hoạch Refactor Để Đúng Bài Toán

Cần tách terminal theo mode/role rõ ràng:

1. Check-in terminal
   - Dùng cho cổng/bảo vệ.
   - Chỉ cho phép `REGISTERED -> WAITING`.
   - Role yêu cầu: `CHECKIN`.
   - Device type có thể là `KIOSK`, `PDA`, `TABLET`.

2. Receiving terminal
   - Dùng cho khu nhận hàng.
   - Chỉ cho phép `CALLED -> RECEIVING` và `RECEIVING -> COMPLETED`.
   - Role yêu cầu: `RECEIVING`.
   - Có thể gắn thiết bị vào unit/zone/slot cụ thể nếu cần.

3. Terminal auth
   - Frontend phải gửi mode/role khi auth.
   - Backend bắt buộc set `roleScoped = true`.
   - Validate `Device` active, `BusinessLocation` active, role PIN đúng mode.
   - Sau này có thể validate static IP nội bộ nếu app config bật.

4. Unit permission
   - Cần có cơ chế device/staff chỉ thao tác unit được chỉ định.
   - Hiện `Device` chưa có unit scope.
   - Hiện `StaffPin` chưa có unit scope.
   - Nếu dùng user login cho kiosk, có thể đưa về `User.unit` hoặc bảng multi-unit permission.

5. API tách rõ hơn
   - Lựa chọn tốt hơn: tách endpoint theo nghiệp vụ:
     - `/api/checkin/scan-check-in`
     - `/api/checkin/scan-start-receiving`
     - `/api/checkin/scan-complete`
   - Hoặc giữ `/scan` nhưng bắt buộc `mode` và validate theo status.

## Kết Luận

`/kiosk` không nên xem là luồng chuẩn hiện tại. Nó là nền tảng device terminal cần refactor trong giai đoạn 2 để khớp với role `CHECKIN` và `RECEIVING`.
