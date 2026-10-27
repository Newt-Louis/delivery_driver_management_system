# Màn Hình Vận Hành: Waiting Screen Và Dock Management

## Mục Tiêu

Ngoài register/check-in/dashboard, hệ thống có các màn hình vận hành để hiển thị hàng đợi và trạng thái slot.

## Waiting Screen

Frontend:

- `frontend/src/pages/WaitingScreen.tsx`: route presentation: unit Tabs/Carousel và responsive layout.
- `frontend/src/features/waiting-screen/hooks/useWaitingScreen.ts`: owner của public scope, queue query, socket/chime và called overlay state.
- `frontend/src/features/waiting-screen/components/bright/*`: Ant Design unit/vehicle presentation components.

Route:

- `/waiting-screen`
- Public read-only route, dùng `GlobalHeader` chung với các public route.
- Có thể truyền scope bằng query:
  - `?businessLocationId=<id>` để TV hiển thị một khu vực kinh doanh cụ thể.
  - `?unitConfigId=<id>` nếu muốn giới hạn vào một unit cụ thể.
- `SocketContext` lấy `businessLocationId` từ `PublicBusinessLocationContext` rồi join realtime room tương ứng. Khi public scope chưa được chọn, waiting screen không join room hoặc tải queue.
- Chọn khu vực dùng public FloatButton toàn cục; waiting screen không còn selector riêng. Khi public scope đổi, SocketContext join lại room và các request `GET /api/brand`/`GET /api/deliveries/queue` tự lấy dữ liệu theo location mới.

Backend/API:

- `GET /api/deliveries/queue`
- `GET /api/brand`
- `GET /api/units/public/business-locations`

Realtime:

- Join waiting screen room qua `SocketContext`.
- Lắng nghe events:
  - `queue_updated`
  - `delivery_called`
  - `delivery_completed`

Mục đích:

- TV/khu chờ hiển thị xe đang chờ, xe được gọi, thông tin ticket/slot.
- Waiting screen chỉ hiển thị `CALLED` trước rồi `WAITING` sau; `RECEIVING` và `AUTO_WAREHOUSE_RECEIVING` không còn hiển thị trên màn hình chờ vì tài xế đã vào khu nhận hàng. Mỗi đơn vị có ba nhóm phương tiện riêng `TRUCK`, `MOTORBIKE`, `OTHER`; trong mỗi nhóm, phần được gọi đứng trước phần đã check-in đang chờ.
- Màn hình hiển thị một đơn vị mỗi lần qua Ant Carousel. Ant Tabs luôn cho phép chọn trực tiếp đơn vị; khi danh sách dài, tab bar cuộn ngang bằng chạm/trackpad nhưng không lộ scrollbar. Từ 1025px, Carousel có nút chuyển, tự sang đơn vị kế tiếp sau 60 giây và ba nhóm phương tiện nằm cạnh nhau; Card đơn vị cuộn dọc nội bộ khi danh sách dài. Đến 1024px, người dùng cũng có thể tự vuốt ngang giữa các đơn vị, còn ba nhóm phương tiện xếp dọc và màn hình cuộn dọc theo chiều cao nội dung tự nhiên, kể cả các trạng thái rỗng. Nếu phần gọi xe của một loại xe trống, UI phân biệt không có xe đã check-in sẵn sàng với xe đang chờ nhưng chưa có vị trí nhận hàng trống.
- Waiting screen không phát chime hoặc chặn màn hình khi xe được gọi; event realtime chỉ làm mới queue và highlight tạm thời dòng `CALLED` vừa xuất hiện.

Quy ước dữ liệu:

- `GET /api/brand?businessLocationId=...` trả brand của `BusinessLocation` và danh sách `UnitConfig` active trong location đó ở object `units`.
- `WaitingScreen` sinh tab/cột unit từ `brand.units`; nếu brand chưa có dữ liệu thì fallback từ unit của các delivery đang hiển thị.
- Frontend không dùng danh sách `EMART`/`THISKYHALL`/`TENANT` làm source of truth nữa. Nhãn, màu, icon và ticket prefix đi qua `frontend/src/lib/unitPresentation.ts`; dữ liệu thiếu metadata được fallback generic từ mã unit.
- `GET /api/deliveries/queue` khi có `businessLocationId` hoặc `unitConfigId` phải lọc bằng `DeliveryRegistration.unitConfigId` và slot thuộc `Zone -> UnitConfig`. Không fallback lỏng theo `receivingUnit` vì unit code có thể trùng giữa nhiều `BusinessLocation`.
- Public queue vẫn là read-only; payload không chứa secret cấu hình unit.

## Track

Frontend:

- `frontend/src/pages/Track.tsx`: route wrapper.
- `frontend/src/features/track/Track.tsx`: implementation.

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
- Frontend ưu tiên `delivery.unitConfig.displayName/shortName/icon/logoUrl/primaryColor` để hiển thị đơn vị nhận hàng. Nếu delivery legacy chưa có `unitConfigId`, UI fallback generic từ snapshot `receivingUnit`.
- Queue estimate trong `backend/src/services/trackRealtime.ts` dùng `delivery.unitConfigId` để tính vị trí chờ, tổng waiting, thời gian nhận hàng cấu hình và slot còn trống. Nếu delivery legacy chưa có `unitConfigId`, service mới fallback theo `receivingUnit`.
- Ticket code format bằng `UnitConfig.shortName/displayName` khi payload có metadata, sau đó mới fallback sang snapshot `receivingUnit + vehicleType + ticketNumber` để tương thích mã thẻ đã cấp.

## Dock Management

Frontend:

- `frontend/src/pages/DockManagement.tsx`: page layout gốc, compose thống kê, nhóm slot và legend.
- `frontend/src/features/docks/api.ts`: API helper cho slot list và đổi trạng thái slot.
- `frontend/src/features/docks/hooks/useDockManagement.ts`: query, quyền edit, realtime invalidation và status action.
- `frontend/src/features/docks/components/*`: stats grid, unit group, vehicle section và legend.
- `frontend/src/features/docks/utils.ts`: tính thống kê và group slot theo unit/vehicle.
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
- `DockCard` dùng chung `unitPresentation.ts` để hiển thị unit trên từng slot card, thay vì giữ map label riêng trong component.

## Lưu Ý

- Waiting screen là read/public surface, cần giữ payload an toàn.
- Dock management là protected surface, không mở cho `CHECKIN`.
- Với `SUPERADMIN`, Dock Management dùng selected operational context trong Redis session giống các route vận hành khác.
- Nếu thêm location mới, các màn hình này cần truyền/resolve scope đúng `businessLocationId` hoặc `unitConfigId`.
