# API Changelog

Nhật ký thay đổi hợp đồng API (REST) và socket event, dành cho người làm app điện thoại, TV và PDA.

Quy ước:

- Mỗi mục ghi ngày, endpoint/event bị ảnh hưởng, thay đổi cụ thể và việc app cần làm.
- **BREAKING** = app đang đọc trường/endpoint đó sẽ hỏng hoặc hiển thị sai nếu không sửa.
- Mục mới nhất nằm trên cùng.

---

## 2026-11-17 — Hiển thị xe mượn slot ở cả hai đơn vị (Việc 4)

### Thêm trường — `GET /api/dashboard/dispatch` (cần đăng nhập)

Không bỏ trường nào; app cũ vẫn chạy. Thêm:

- `[unit].active[].unitConfig`: UnitConfig của **chính xe** (`id`, `unit`, `displayName`, `shortName`, `icon`, `logoUrl`, `primaryColor`, `businessLocationId`). Trước đây không có, nên app thường lấy nhầm `assignedSlot.zone.unitConfig` (đơn vị sở hữu slot). Khi xe mượn slot, hai giá trị này khác nhau: **đơn vị/số thẻ phải lấy theo `unitConfig`**.
- `[unit].active[].slotBorrow`: `{ "lenderUnitConfigId": "…", "borrowerUnitConfigId": "…" }` khi xe đang ở slot của đơn vị khác, ngược lại `null`.
- `[unit].lentSlotRows[]`: xe của đơn vị khác đang chiếm slot của đơn vị `[unit]`. Mỗi phần tử có `isLentSlotRow: true`, `slotBorrow`, và `detailRestricted`:
  - `false`: người gọi có quyền trên đơn vị của xe, phần tử có đủ trường như `active[]`.
  - `true`: không có quyền, phần tử chỉ còn dạng rút gọn như `GET /api/deliveries/queue` (không có tài xế/NCC/PO/note/`registrationCode`). Gọi `GET /api/deliveries/:id` cho xe này sẽ bị `403`.
- `lentSlotRows` **không** được tính vào `insights.stats`, `alerts`, `recommendations` của đơn vị cho mượn.

App nên hiển thị `lentSlotRows` ở chế độ chỉ đọc (khoá thao tác).

### Hành vi socket

Event của xe mượn slot (`queue_updated`, `slot_updated`, `delivery_called`, `delivery_completed`) giờ phát vào phòng `unit-config:{id}` của **cả** đơn vị sở hữu slot **và** đơn vị của xe (trước đây chỉ đơn vị sở hữu slot).

---

## 2026-11-17 — Bỏ timeline khỏi chi tiết lượt giao hàng

### BREAKING — `GET /api/deliveries/:id` (cần đăng nhập)

Response **không còn** trường `historyEvents`. Các trường khác giữ nguyên, vẫn có `callCount`. Lý do: dashboard không hiển thị timeline nữa, nên bỏ một query lịch sử cho mỗi lần mở chi tiết.

App cần timeline của một chuyến thì dùng API lịch sử (`/api/histories`).

---

## 2026-11-17 — "Mượn slot" và quyền gọi xe vào slot đơn vị khác (Việc 3)

### Mới — `GET /api/deliveries/:id/borrowable-slots` (cần đăng nhập)

Role `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`; người gọi cần quyền trên đơn vị của xe. Chỉ cho xe `WAITING` (khác: `409`, `error: "InvalidStatus"`).

```json
{
  "deliveryId": "…",
  "vehicleType": "TRUCK",
  "sameUnit": [
    { "id": "…", "name": "Vị trí E2", "vehicleType": "TRUCK", "maxCapacity": 5, "activeCount": 0,
      "zone": { "id": "…", "code": "…", "name": "…" },
      "unitConfig": { "id": "…", "unit": "EMART", "displayName": "Emart", "shortName": "Emart", "icon": "", "logoUrl": null, "primaryColor": "#…", "businessLocationId": "…" } }
  ],
  "otherUnits": [
    { "id": "…", "name": "Vị trí M1", "vehicleType": "TRUCK", "maxCapacity": 1, "activeCount": 0, "zone": { "…": "…" }, "unitConfig": { "unit": "MALL", "…": "…" } }
  ]
}
```

- `sameUnit`: slot cùng đơn vị với xe, còn chỗ (`activeCount < maxCapacity`).
- `otherUnits`: slot đơn vị khác trong cùng khu vực, **không có xe nào** (`activeCount = 0`).
- Chỉ slot đang hoạt động, không `MAINTENANCE`/`RESERVED`, cùng `vehicleType` với xe. Không lọc theo phạm vi đơn vị của người dùng.
- Gọi xe vào slot đã chọn vẫn dùng `PATCH /api/deliveries/:id/call` với `{ "slotId": "…" }`.

### Thay đổi quyền — `PATCH /api/deliveries/:id/call`

Trước đây người gọi phải có quyền trên **cả đơn vị sở hữu slot**. Giờ chỉ cần quyền trên **đơn vị của xe** và slot cùng khu vực. Luật sức chứa giữ nguyên: slot đơn vị khác phải trống hoàn toàn. App PDA/điện thoại trước đây nhận `403` khi mượn slot đơn vị khác thì giờ sẽ gọi được.

### Hành vi mới — `PATCH /api/slots/:id`

Khi đổi `autoAssign` từ `false` sang `true`, server tự gọi xe đang chờ vào các slot còn trống của đơn vị đó ngay. Hệ quả: có thể có thêm các event `delivery_called`, `queue_updated`, `slot_updated` ngay sau request.

---

## 2026-11-17 — Chặn lộ dữ liệu cá nhân trên kênh public (Việc 0)

### BREAKING — `GET /api/deliveries/queue` (public, không cần đăng nhập)

Response vẫn là mảng delivery đang hoạt động (`WAITING`, `CALLED`, `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING`), nhưng mỗi phần tử **chỉ còn** các trường sau:

```json
{
  "id": "…",
  "status": "CALLED",
  "ticketNumber": 7,
  "vehiclePlate": "51C-123.45",
  "vehicleType": "TRUCK",
  "goodsType": "FRESH_FOOD",
  "receivingUnit": "EMART",
  "unitConfigId": "…",
  "assignedSlotId": "…",
  "checkinTime": "2026-11-17T01:50:37.474Z",
  "calledTime": "2026-11-17T02:54:55.404Z",
  "receivingStartTime": null,
  "createdAt": "2026-11-17T01:49:05.421Z",
  "callCount": 1,
  "unitConfig": {
    "id": "…", "unit": "EMART", "businessLocationId": "…",
    "displayName": "Emart", "shortName": "Emart", "icon": "", "logoUrl": null, "primaryColor": "#…"
  },
  "assignedSlot": {
    "id": "…", "name": "E1", "vehicleType": "TRUCK",
    "zone": { "id": "…", "code": "…", "name": "…", "unitConfigId": "…", "unitConfig": { "…": "như trên" } }
  }
}
```

**Đã bỏ:** `registrationCode`, `driverName`, `driverPhone`, `vendorName`, `vendorCode`, `poNumber`, `note`, `requestedTime`, `completedTime`, `cancelReason`, `autoWarehouse`, `unitGoodsTypeId`, `updatedAt` và toàn bộ cột cấu hình của `assignedSlot` (trừ `id`, `name`, `vehicleType`, `zone`).

Lý do: endpoint này public. `registrationCode` là chìa khoá mở trang theo dõi `/track/:code` của tài xế, còn tên/SĐT là dữ liệu cá nhân.

App cần làm:

- Không dùng `registrationCode` để hiển thị hay sắp xếp. Số thứ tự hiển thị ghép từ `unitConfig`/`receivingUnit` + `vehicleType` + `ticketNumber`. Khi chưa có `ticketNumber` thì hiện `—`.
- Cần thông tin tài xế thì gọi API vận hành có đăng nhập (`GET /api/deliveries/:id`, `GET /api/dashboard/dispatch`).

### BREAKING — socket `queue_updated`

Payload là mảng delivery **cùng định dạng rút gọn** như `GET /api/deliveries/queue` ở trên. Event này phát vào phòng `business-location:{id}` và `unit-config:{id}`. Hai phòng này join được **không cần đăng nhập**, nên payload phải là bản public.

### BREAKING — socket `slot_updated`

Payload vẫn là mảng slot đang hoạt động, mỗi slot gồm: `id`, `name`, `code`, `vehicleType`, `status`, `assignedUnit`, `zoneId`, `maxCapacity`, `isActive`, `autoAssign`, `zone { id, code, name, unitConfigId, unitConfig }`, `deliveries[]`.

`deliveries[]` của mỗi slot giờ dùng **cùng định dạng rút gọn** như `queue_updated`; các trường tài xế/NCC/PO/note/`registrationCode` đã bị bỏ. Web dashboard và docks chỉ dùng event này làm tín hiệu tải lại, không đọc payload.

### Không đổi định dạng — `GET /api/dashboard/dispatch` (cần đăng nhập)

`active[].assignedSlot.zone.unitConfig` trước đây trả **toàn bộ cột** của `UnitConfig`, kể cả `vendorApiKey` và `poApiKey`. Giờ chỉ còn `id`, `unit`, `displayName`, `shortName`, `icon`, `logoUrl`, `primaryColor`, `businessLocationId`. App không được phụ thuộc vào hai trường API key.
