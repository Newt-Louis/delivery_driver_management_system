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

- `queue_updated`
- `delivery_called`
- `slot_updated`
- `delivery_completed`
- `track_updated`

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
- `frontend/src/pages/WaitingScreen.tsx` -> `frontend/src/features/waiting-screen/WaitingScreen.tsx`
- `frontend/src/pages/DockManagement.tsx` và `frontend/src/features/docks/*`
- `frontend/src/pages/Track.tsx` -> `frontend/src/features/track/Track.tsx`

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

## Lưu Ý

- Track tài xế có room riêng theo `registrationCode`, không dùng dashboard room.
