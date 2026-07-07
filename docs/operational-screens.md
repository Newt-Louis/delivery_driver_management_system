# Màn Hình Vận Hành: Waiting Screen Và Dock Management

## Mục Tiêu

Ngoài register/check-in/dashboard, hệ thống có các màn hình vận hành để hiển thị hàng đợi và trạng thái slot.

## Waiting Screen

Frontend:

- `frontend/src/pages/WaitingScreen.tsx`

Route:

- `/waiting-screen`
- Public fullscreen, không hiển thị navbar.

Backend/API:

- `GET /api/deliveries/queue`
- `GET /api/brand`

Realtime:

- Join waiting screen room qua `SocketContext`.
- Lắng nghe events:
  - `queue_updated`
  - `delivery_called`
  - `delivery_completed`

Mục đích:

- TV/khu chờ hiển thị xe đang chờ, xe được gọi, thông tin ticket/slot.
- Có chime khi xe được gọi.

## Dock Management

Frontend:

- `frontend/src/pages/DockManagement.tsx`
- `frontend/src/components/DockCard.tsx`

Route:

- `/docks`
- Protected roles: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.

Backend/API:

- `GET /api/slots`
- `GET /api/dashboard/dispatch`
- `PATCH /api/slots/:id/status`
- `POST /api/slots/:id/reconcile`
- `POST /api/slots/reconcile`

Realtime:

- Lắng nghe `slot_updated`, `queue_updated`, `delivery_called`, `delivery_completed`.

Mục đích:

- Theo dõi trạng thái slot.
- Chuyển slot sang `MAINTENANCE`/`RESERVED`.
- Reconcile trạng thái slot khi cần sửa lệch dữ liệu vận hành.

## Lưu Ý

- Waiting screen là read/public surface, cần giữ payload an toàn.
- Dock management là protected surface, không mở cho `CHECKIN`.
- Nếu thêm location mới, các màn hình này cần truyền/resolve scope đúng `businessLocationId` hoặc `unitConfigId`.
