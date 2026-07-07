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
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/WaitingScreen.tsx`
- `frontend/src/pages/DockManagement.tsx`
- `frontend/src/pages/Track.tsx`

`SocketContext`:

- Tạo socket singleton.
- Resolve scope từ query `businessLocationId`, `locationId`, `unitConfigId`.
- Nếu query không có scope, gọi `/api/brand` để lấy location mặc định.
- Join room theo route hiện tại.

## Scope

- Non-superadmin API vận hành được scope theo `businessLocationId` trong middleware.
- Socket room cũng scope theo `BusinessLocation`/`UnitConfig`.
- Nếu không suy ra được scope, backend còn fallback global để không làm hỏng flow cũ.

## Lưu Ý

- README cũ có thể nhắc `dock_updated`, nhưng code hiện dùng `slot_updated`.
- Track tài xế có room riêng theo `registrationCode`, không dùng dashboard room.
