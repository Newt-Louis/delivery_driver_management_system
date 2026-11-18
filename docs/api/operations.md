# API Vận Hành (Cần Đăng Nhập)

Mọi request gửi `Authorization: Bearer <token>`. Quy ước chung, mã lỗi: xem [README.md](README.md). Dữ liệu tự lọc theo khu vực của tài khoản; role có giới hạn đơn vị chỉ thấy/thao tác đơn vị được cấp.

## Đăng Nhập Và Phiên

### `POST /api/auth/login`

Body `{ "email": "…", "password": "…", "deviceId": "…"?, "deviceName": "…"?, "force": false? }`.

```json
{
  "token": "<JWT>",
  "expiresAt": "…",
  "expiresInSeconds": 900,
  "user": { "id": "…", "name": "…", "email": "…", "role": "RECEIVING", "businessLocationId": "…" },
  "session": { "id": "…", "deviceId": "…", "deviceName": "…", "expiresInSeconds": 0 },
  "unitPermissions": [{ "id": "…", "unit": "EMART", "displayName": "Emart", "businessLocationId": "…" }],
  "authPolicy": { "staticIpEnabled": false, "faceIdEnabled": false }
}
```

- Mỗi tài khoản có thể bị giới hạn **một phiên**. Đang có phiên ở thiết bị khác thì trả `409 { "error": "ActiveSessionExists", "activeSessions": [...] }`; gửi lại với `"force": true` để đăng xuất phiên cũ. App nên gửi `deviceId` cố định cho mỗi thiết bị: đăng nhập lại trên cùng `deviceId` thay phiên cũ mà không cần `force`.
- Có thể yêu cầu Face ID (`faceIdRequired: true`) tuỳ cấu hình.

### `POST /api/auth/renew`

Header Bearer token hiện tại. Trả token mới (cùng dạng login).

### `GET /api/auth/me`, `POST /api/auth/logout`

Thông tin tài khoản hiện tại; đăng xuất (thu hồi phiên). **App nên gọi logout khi người dùng thoát**, để không bị chặn bởi giới hạn một phiên.

### `POST /api/auth/operational-context` (chỉ `SUPERADMIN`)

Body `{ "businessLocationId": "…" }`: chọn khu vực vận hành cho phiên Superadmin.

## Check-in (`SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`)

### `PATCH /api/deliveries/check-in-lookup`

Body `{ "registrationCode": "…"? , "vehiclePlate": "…"?, "overrideDeliveryWindow": false? }` (một trong hai mã). Check-in lượt `REGISTERED` hôm nay: chuyển `WAITING`, cấp `ticketNumber`. Gọi lại cho lượt đã `WAITING` trả lại lượt đó (không cấp số mới). Ngoài khung giờ giao hàng: `ADMIN_OPE` trở lên có thể gửi `overrideDeliveryWindow: true`.

### `PATCH /api/deliveries/:id/check-in`

Body `{ "overrideDeliveryWindow": false? }`. Như trên, theo id.

## Dashboard Điều Phối (`SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`)

### `GET /api/dashboard/summary`

Các con số tổng: `waiting`, `freshFoodWaiting`, `receiving`, `slotsOccupied`, `slotsAvailable`, `totalToday`, `completedToday`, `cancelledToday`, `noShowRisk`, `urgentFreshFood`, `registeredToday`, `expiredToday`, `totalRegisteredToday`, `totalCheckedInToday` (cùng alias cũ `docksOccupied`, `docksAvailable`).

### `GET /api/dashboard/dispatch`

Object theo mã đơn vị trong phạm vi người dùng:

```json
{
  "EMART": {
    "unitConfig": { "id": "…", "unit": "EMART", "displayName": "Emart", "shortName": "Emart", "icon": "", "logoUrl": null, "primaryColor": "#…", "businessLocationId": "…" },
    "active": [ /* chuyến WAITING/CALLED/RECEIVING/AUTO_WAREHOUSE_RECEIVING của đơn vị */ ],
    "lentSlotRows": [ /* xe đơn vị khác đang ở slot của đơn vị này */ ],
    "upcoming": [ /* REGISTERED hôm nay */ ],
    "insights": { "alerts": [], "recommendations": [], "stats": { "waiting": 0, "called": 0, "receiving": 0, "slotsTotal": 0, "slotsAvailable": 0, "…": 0 }, "nextHour": { "count": 0, "firstSlot": null } }
  }
}
```

`active[]`: `id`, `registrationCode`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `vendorName`, `driverName`, `driverPhone`, `poNumber`, `requestedTime`, `checkinTime`, `calledTime`, `receivingStartTime`, `createdAt`, `callCount`, `slotBorrow`, `assignedSlot { id, name, vehicleType, zone { id, code, name, unitConfigId } }`.

- **Đơn vị của dòng:** dùng `unitConfig` của dòng nếu có, nếu không thì `[unit].unitConfig`. `unitConfig` (và `assignedSlot.zone.unitConfig`) **chỉ có trên dòng mượn slot** (`slotBorrow != null`), vì chỉ ở đó đơn vị của xe khác đơn vị của slot.
- `slotBorrow`: `{ lenderUnitConfigId, borrowerUnitConfigId }` khi xe đang ở slot đơn vị khác, ngược lại `null`.
- `lentSlotRows[]`: thêm `isLentSlotRow: true` và `detailRestricted`. `detailRestricted: true` nghĩa là người dùng không có quyền trên đơn vị của xe: dòng chỉ có dạng rút gọn (không tài xế/NCC/PO/`registrationCode`), mọi thao tác bị chặn. Không tính vào `insights` của đơn vị cho mượn. App hiển thị chỉ đọc.
- `upcoming[]`: `id`, `registrationCode`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `vendorName`, `requestedTime`, `createdAt`.

Khi nhận socket `queue_updated`/`slot_updated` (tín hiệu, xem [realtime.md](realtime.md)) thì gọi lại API này. Gộp các tín hiệu đến cùng lúc thành một lần gọi.

### `POST /api/dashboard/expire-stale` (`SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`)

Chạy thủ công việc đóng cuối ngày cho phạm vi người dùng.

## Vòng Đời Chuyến (`SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`)

Người dùng phải có quyền trên **đơn vị của chuyến**. Chuyến khác khu vực hoặc ngoài đơn vị được cấp trả `403`.

### `GET /api/deliveries/:id`

Chi tiết một chuyến: `id`, `registrationCode`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `vendorName`, `driverName`, `driverPhone`, `poNumber`, `note`, `cancelReason`, `requestedTime`, `createdAt`, `checkinTime`, `calledTime`, `receivingStartTime`, `completedTime`, `callCount`, `unitConfig`, `assignedSlot { id, name, vehicleType, zone { id, code, name } }`. Không có timeline (xem `/api/histories`).

### `GET /api/deliveries/:id/borrowable-slots`

Chỉ cho chuyến `WAITING` (khác: `409 InvalidStatus`). Slot có thể gọi xe vào ("Mượn slot"), cùng loại xe, cùng khu vực, không lọc theo đơn vị người dùng được cấp:

```json
{
  "deliveryId": "…",
  "vehicleType": "TRUCK",
  "sameUnit": [ { "id": "…", "name": "Vị trí E4", "vehicleType": "TRUCK", "maxCapacity": 5, "activeCount": 0, "zone": { "id": "…", "code": "…", "name": "…" }, "unitConfig": { "id": "…", "unit": "EMART", "…": "…" } } ],
  "otherUnits": [ /* slot đơn vị khác, đang trống hoàn toàn */ ]
}
```

`sameUnit`: còn chỗ (`activeCount < maxCapacity`). `otherUnits`: không có xe nào.

### `PATCH /api/deliveries/:id/call`

Body `{ "slotId": "…" }`.

- Chuyến `WAITING`: gọi vào slot (`CALLED`), gửi thông báo cho tài xế.
- Chuyến `CALLED` + **cùng slot đang gọi**: **gọi lại**, chỉ phát lại thông báo, không đổi trạng thái/slot. Chưa có chống spam phía server.
- Slot đơn vị khác phải trống hoàn toàn; slot cùng đơn vị phải còn chỗ; slot `MAINTENANCE`/`RESERVED` bị từ chối (400). Không cần quyền trên đơn vị sở hữu slot.

### `PATCH /api/deliveries/:id/start-receiving`

`CALLED` → `RECEIVING` (hoặc `AUTO_WAREHOUSE_RECEIVING` với hàng kho tự động).

### `PATCH /api/deliveries/:id/complete`

`RECEIVING`/`AUTO_WAREHOUSE_RECEIVING` → `COMPLETED`, giải phóng slot, tự gọi xe chờ tiếp theo vào slot vừa trống (theo đơn vị sở hữu slot).

### `PATCH /api/deliveries/:id/cancel`

Body `{ "reason": "…" }` (ít nhất 3 ký tự). Huỷ chuyến chưa kết thúc, giải phóng slot nếu có.

### `POST /api/deliveries/auto-dispatch/:unit`

Chạy tự động điều xe ngay cho đơn vị.

### `GET /api/deliveries?unit=…&goodsType=…&status=…`

Danh sách chuyến trong phạm vi (dùng cho màn hình nội bộ khác).

## Slot

### `GET /api/slots` (`SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`), `GET /api/slots/all` (`SUPERADMIN`, `ADMIN_LOC`, gồm slot ngưng hoạt động)

Mỗi slot: `id`, `name`, `assignedUnit`, `vehicleType`, `acceptedGoods`, `goodsPriority`, `autoAssign`, `maxCapacity`, `status`, `isActive`, `lastUsedAt`, `zoneId`, `zone { id, code, name, unitConfig }`, `deliveries[]` (xe đang ở slot: `id`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `vendorName`, `checkinTime`, `calledTime`, `receivingStartTime`, `createdAt`). Không trả `code`.

### `PATCH /api/slots/:id/status`

Body `{ "status": "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE" }`. `MAINTENANCE`/`RESERVED` là trạng thái thủ công; `AVAILABLE`/`OCCUPIED` được hệ thống tự tính lại theo xe trong slot.

### `PATCH /api/slots/:id/assign`

Body `{ "deliveryId": "…" }`: gán chuyến vào slot (luồng cũ; dashboard dùng `PATCH /api/deliveries/:id/call`).

### `POST /api/slots/:id/reconcile`, `POST /api/slots/reconcile`

Tính lại trạng thái slot theo xe đang chiếm (bảo trì dữ liệu).

### Bật/tắt tự động điều xe (`PATCH /api/slots/:id`, `SUPERADMIN`, `ADMIN_LOC`)

Body có `autoAssign: true|false`. Tắt có hiệu lực ngay cho lần gán tiếp theo; bật lại thì server tự gọi xe chờ vào slot trống ngay.
