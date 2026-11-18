# Realtime (Socket.IO)

Kết nối Socket.IO tới cùng origin (`/socket.io`). Sau khi kết nối (và **sau mỗi lần kết nối lại**) phải join lại phòng, rồi gọi lại REST để đồng bộ, vì event phát lúc mất kết nối sẽ bị mất.

## Join Phòng

### `realtime:join` (client → server, có ack)

| Màn hình | Payload | Phòng được join |
|---|---|---|
| Màn hình chờ / TV (public) | `{ "businessLocationId": "…", "waitingScreen": true }` | `business-location:{id}`, `waiting-screen:{id}` |
| Public theo đơn vị | `{ "unitConfigId": "…" }` | `unit-config:{id}` (+ khu vực) |
| Dashboard / docks (cần đăng nhập) | `{ "dashboard": true, "token": "<JWT>" }` | khu vực lấy từ phiên; role giới hạn đơn vị chỉ join `unit-config:{id}` được cấp |

Ack: `{ "ok": true, "rooms": ["…"] }` hoặc `{ "ok": false, "error": "missing_scope" | "invalid_scope" }`. `realtime:leave` để rời.

### `track:join` / `track:leave` (tài xế)

Gửi `registrationCode`, ack `{ "ok": true, "room": "track:CODE" }`. Nhận `track_updated` và `driver_notification` của riêng chuyến đó.

## Event Server → Client

| Event | Phòng | Payload | Dùng để |
|---|---|---|---|
| `queue_updated` | `business-location:{id}`, `unit-config:{id}` | **Tín hiệu** `{ "businessLocationId": "…", "unitConfigIds": ["…"], "at": "ISO" }` | Hàng chờ thay đổi: gọi lại REST đang hiển thị (dispatch, slot…) |
| `slot_updated` | như trên | **Tín hiệu** cùng dạng | Slot thay đổi (trạng thái, cấu hình, xe ra/vào) |
| `delivery_called` | như trên | `{ "id", "vehiclePlate", "slotName", "message", "receivingUnit", "callCount", "isAutoAssign", "ticketCode" }` | Có xe được gọi / gọi lại (âm báo, làm nổi dòng) |
| `delivery_completed` | như trên | `{ "id" }` | Chuyến hoàn tất |
| `waiting_board_updated` | `waiting-screen:{id}` | Giống `GET /api/waiting-screen/board` | TV cập nhật bảng; server gom 400 ms theo khu vực |
| `track_updated` | `track:{code}` | Giống `GET /api/track/:code` | Trang theo dõi của tài xế |
| `driver_notification` | `track:{code}` | `{ deliveryCode, status, occurredAt, eventId, title, body }` | Thông báo cá nhân trong app, phát trước web push |

Ghi chú:

- `queue_updated` / `slot_updated` **không còn chứa dữ liệu** (từ 2026-11-18). Một thao tác thường phát nhiều event gần như cùng lúc (`delivery_called` + `queue_updated` + `slot_updated`): app nên gộp lại và chỉ gọi REST một lần (debounce vài trăm ms, hoặc bỏ qua khi đang có request chạy).
- Phòng `business-location` và `unit-config` join được không cần đăng nhập, nên không event nào trong đó mang dữ liệu cá nhân.
- `ticketCode` trong `delivery_called` hiện ghép theo mã đơn vị (`EMART-T007`), có thể khác số thẻ trên màn hình nếu đơn vị đặt `shortName` khác mã (nợ kỹ thuật). Hiển thị số thẻ nên lấy từ board/dispatch.
- Xe mượn slot: event phát vào phòng `unit-config` của cả đơn vị của xe lẫn đơn vị sở hữu slot.
