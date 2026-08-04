# Màn Hình Vận Hành: Waiting Screen Và Dock Management

## Mục Tiêu

Ngoài register/check-in/dashboard, hệ thống có các màn hình vận hành để hiển thị hàng đợi và trạng thái slot.

## Waiting Screen

Frontend:

- `frontend/src/pages/WaitingScreen.tsx`

Route:

- `/waiting-screen`
- Public fullscreen, không hiển thị navbar.
- Có thể truyền scope bằng query:
  - `?businessLocationId=<id>` để TV hiển thị một khu vực kinh doanh cụ thể.
  - `?unitConfigId=<id>` nếu muốn giới hạn vào một unit cụ thể.
- Nếu URL không truyền scope, `SocketContext` resolve default public brand/location rồi join realtime room theo `businessLocationId` đó.

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

Quy ước dữ liệu:

- `GET /api/brand?businessLocationId=...` trả brand của `BusinessLocation` và danh sách `UnitConfig` active trong location đó ở object `units`.
- `WaitingScreen` sinh tab/cột unit từ `brand.units`; nếu brand chưa có dữ liệu thì fallback từ unit của các delivery đang hiển thị.
- Frontend không dùng danh sách `EMART`/`THISKYHALL`/`TENANT` làm source of truth nữa. Các key legacy chỉ còn là fallback label/icon khi gặp dữ liệu cũ thiếu brand.
- `GET /api/deliveries/queue` khi có `businessLocationId` hoặc `unitConfigId` phải lọc bằng `DeliveryRegistration.unitConfigId` và slot thuộc `Zone -> UnitConfig`. Không fallback lỏng theo `receivingUnit` vì unit code có thể trùng giữa nhiều `BusinessLocation`.
- Public queue vẫn là read-only; payload không chứa secret cấu hình unit.

## Track

Frontend:

- `frontend/src/pages/Track.tsx`

Route:

- `/track`
- `/track/:code`
- Public, dành cho tài xế/NCC theo dõi một lượt đăng ký cụ thể.

Backend/API:

- `GET /api/track/search?plate=...`
- `GET /api/track/:code`
- `POST /api/track/active-session`

Realtime:

- Client join room `track:<registrationCode>` qua socket event `track:join`.
- Backend emit `track_updated` khi delivery thay đổi trạng thái hoặc queue liên quan thay đổi.

Quy ước dữ liệu:

- `GET /api/track/:code` trả `unitConfig` của delivery và `assignedSlot.zone.unitConfig` nếu delivery đã được gọi vào slot.
- Frontend ưu tiên `delivery.unitConfig.displayName/shortName/icon/logoUrl/primaryColor` để hiển thị đơn vị nhận hàng. `UNIT_LABEL` cũ chỉ còn là fallback cho delivery legacy chưa có `unitConfigId`.
- Queue estimate trong `backend/src/services/trackRealtime.ts` dùng `delivery.unitConfigId` để tính vị trí chờ, tổng waiting, thời gian nhận hàng cấu hình và slot còn trống. Nếu delivery legacy chưa có `unitConfigId`, service mới fallback theo `receivingUnit`.
- Ticket code hiện vẫn format bằng snapshot `receivingUnit + vehicleType + ticketNumber` để tương thích mã thẻ đã cấp.

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
- Slot list được backend lọc theo `businessLocationId` và `operationUnits` của user hiện tại.
- Frontend group slot theo `slot.zone.unitConfig` động, không dùng danh sách unit hardcode. Nếu dữ liệu legacy thiếu metadata thì UI fallback về `assignedUnit`.

## Lưu Ý

- Waiting screen là read/public surface, cần giữ payload an toàn.
- Dock management là protected surface, không mở cho `CHECKIN`.
- Với `SUPERADMIN`, Dock Management dùng selected operational context trong Redis session giống các route vận hành khác.
- Nếu thêm location mới, các màn hình này cần truyền/resolve scope đúng `businessLocationId` hoặc `unitConfigId`.
