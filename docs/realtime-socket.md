# Realtime Bằng Socket.IO

## Mục Tiêu

Socket.IO dùng để đẩy thay đổi realtime xuống dashboard, waiting screen, dock management và trang track tài xế khi app đang mở.

## Backend

File:

- `backend/src/socket/index.ts`
- `backend/src/services/realtimeScope.ts`
- `backend/src/services/trackRealtime.ts`

Rooms:

- `business-location:{businessLocationId}`
- `unit-config:{unitConfigId}`
- `dashboard:{businessLocationId}`
- `waiting-screen:{businessLocationId}`
- `track:{registrationCode}`

Events client -> server:

- `realtime:join`
- `realtime:leave`
- `track:join`
- `track:leave`

Events server -> client:

- `queue_updated`: mảng delivery đang hoạt động, dạng public rút gọn (`toPublicQueue`).
- `delivery_called`
- `slot_updated`: mảng slot đang hoạt động; `deliveries[]` trong slot cũng là dạng public rút gọn (`toPublicSlots`).
- `waiting_board_updated`: board của waiting screen (`buildWaitingBoard`), chỉ phát vào `waiting-screen:{businessLocationId}`, gom 400 ms theo khu vực. `emitQueueUpdated()`/`emitSlotUpdated()` tự lên lịch phát, nên mọi luồng thay đổi queue/slot đều kích hoạt.
- `delivery_completed`
- `track_updated`
- `driver_notification`: sự kiện cá nhân theo mã chuyến, gồm `deliveryCode/status/occurredAt/eventId/title/body`; emit trước I/O gửi Web Push.

Hàm chính:

- `initSocket(server)`
- `validateSocketScope(payload)`
- `businessLocationRoomName()`
- `unitConfigRoomName()`
- `dashboardRoomName()`
- `waitingScreenRoomName()`
- `emitQueueUpdated(queue, scope)`
- `emitDeliveryCalled(data, scope)`
- `emitSlotUpdated(slots, scope)`
- `emitDeliveryCompleted(id, scope)`
- `trackRoomName(registrationCode)`
- `emitTrackUpdated(registrationCode)`
- `emitTrackUpdatesForQueue(queue)`

## Frontend

File:

- `frontend/src/context/SocketContext.tsx`
- `frontend/src/pages/Dashboard.tsx` và `frontend/src/features/dashboard/*`
- `frontend/src/pages/WaitingScreen.tsx` + `frontend/src/features/waiting-screen/hooks/useWaitingScreen.ts`
- `frontend/src/pages/DockManagement.tsx` và `frontend/src/features/docks/*`
- `frontend/src/pages/Track.tsx` -> `frontend/src/features/track/hooks/useTrackContent.ts`
- `frontend/src/features/driver-notifications/DriverNotificationsProvider.tsx`: giữ room chuyến được chọn xuyên route.
- `frontend/src/lib/trackRoom.ts`: room lease chia sẻ giữa provider toàn cục và trang chi tiết; tự join lại sau reconnect.

`SocketContext`:

- Tạo socket singleton.
- Với dashboard/docks, lấy `businessLocationId` từ AuthContext (selected operational context của Superadmin hoặc location cố định của role khác); query không được ghi đè location này.
- Với waiting screen public, resolve scope từ query `businessLocationId`, `locationId`, `unitConfigId`; nếu query không có scope mới gọi `/api/brand` để lấy location mặc định.
- Join room theo route hiện tại.
- Dashboard/docks gửi token hiện tại trong payload `realtime:join`, join lại sau reconnect và rejoin khi operational context thay đổi.

## Scope

- Mọi API vận hành được scope theo `businessLocationId` trong auth profile hiện tại, kể cả Superadmin.
- Với socket dashboard/docks, backend xác thực token rồi suy ra BusinessLocation từ session. Role có unit permission chỉ join các `unit-config:{id}` được cấp, không join room toàn location.
- Payload có BusinessLocation/UnitConfig khác auth scope bị từ chối. Event thiếu scope bị bỏ qua, không broadcast global.
- Track room public chỉ theo `registrationCode`; dashboard/docks room yêu cầu token hợp lệ khi join.
- Phòng `business-location:{id}` và `unit-config:{id}` join được **không cần đăng nhập** (waiting screen public dùng `realtime:join` không có token). Vì vậy mọi payload phát vào các phòng này phải là dữ liệu public. `emitQueueUpdated()` và `emitSlotUpdated()` tự chiếu payload qua `domain/publicDeliveryView.ts`; dữ liệu nội bộ (ví dụ `registrationCode` cho `emitTrackUpdatesForQueue`) vẫn dùng bản đầy đủ phía server, không gửi ra client.
- Dashboard và docks chỉ dùng `queue_updated`/`slot_updated` làm tín hiệu invalidate/tải lại, không đọc payload.
- Xe mượn slot ("Mượn slot"): `getScopeForDelivery()` trả `unitConfigId` = đơn vị sở hữu slot và `unitConfigIds` = [đơn vị slot, đơn vị của xe], nên event phát vào phòng `unit-config` của **cả hai** đơn vị. Nhân sự chỉ có quyền một đơn vị (chỉ join phòng unit của mình) vẫn nhận realtime khi xe của mình ở slot đơn vị khác, hoặc khi slot của mình bị mượn.
- Thay đổi định dạng payload ghi trong `docs/api/CHANGELOG.md`.

## Lưu Ý

- Track tài xế có room riêng theo `registrationCode`, không dùng dashboard room.
- Chỉ xem Track không tự chọn nhận thông báo cá nhân. Sau thao tác theo dõi, provider giữ room ngay cả khi sang `/waiting-screen`; event queue toàn khu vực không kích hoạt cảnh báo cá nhân. Chi tiết: `track-pwa-push.md`.
