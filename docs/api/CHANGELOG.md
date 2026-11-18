# API Changelog

Nhật ký thay đổi hợp đồng API (REST) và socket event, dành cho người làm app điện thoại, TV và PDA.

Quy ước:

- Mỗi mục ghi ngày, endpoint/event bị ảnh hưởng, thay đổi cụ thể và việc app cần làm.
- **BREAKING** = app đang đọc trường/endpoint đó sẽ hỏng hoặc hiển thị sai nếu không sửa.
- Mục mới nhất nằm trên cùng.

---

## 2026-11-18 — Đăng ký phải theo khu vực tài xế đã chọn (Việc 7)

### BREAKING — `POST /api/deliveries/quick-verify`

- Body bắt buộc thêm `businessLocationId` (khu vực tài xế đã chọn). Thiếu → `400 Validation Error`.
- Nếu khu vực của mã do bên thứ 3 trả về khác `businessLocationId` → `404 { "error": "OrderCodeNotFoundInLocation", "message": "Mã PO không tồn tại." | "Mã Thi Công không tồn tại." }`, không cấp `verificationToken`.

### BREAKING — `POST /api/deliveries/register`

- `businessLocationId` **bắt buộc** (trước đây tuỳ chọn; thiếu thì server tự lấy khu vực đầu tiên). Thiếu → `400 Validation Error`.
- Đăng ký nhanh (`quickVerificationToken`): `businessLocationId` phải trùng khu vực đã xác thực trong token, khác → `404 OrderCodeNotFoundInLocation` như trên.

### Nội bộ — gọi API kiểm tra PO

Backend bỏ trường mã công ty mặc định trong request gửi sang API kiểm tra PO của bên thứ 3 (bên thứ 3 xác nhận không còn dùng). Request PO chỉ còn `EBELN = <mã PO>`. Không ảnh hưởng app.

---

## 2026-11-18 — Socket chỉ gửi tín hiệu, dispatch gọn hơn (Việc 6, phần 2)

Tài liệu đầy đủ hiện hành: [README.md](README.md), [public.md](public.md), [operations.md](operations.md), [realtime.md](realtime.md).

### BREAKING — socket `queue_updated`, `slot_updated`

Không còn mang dữ liệu (thay cho định dạng ở mục Việc 0 và Việc 6 phần 1). Payload chỉ là tín hiệu:

```json
{ "businessLocationId": "…", "unitConfigIds": ["…"], "at": "2026-11-18T02:00:00.000Z" }
```

App nhận tín hiệu thì gọi lại REST đang hiển thị (`GET /api/dashboard/dispatch`, `GET /api/slots`, …); TV dùng `waiting_board_updated`. Lý do: trước đây mỗi thao tác phát khoảng 114 KB (`queue_updated`, 300 xe) + 5,7 KB (`slot_updated`) tới mọi client trong khu vực.

### BREAKING — `GET /api/dashboard/dispatch`: `unitConfig` theo dòng

`[unit].active[].unitConfig` và `[unit].active[].assignedSlot.zone.unitConfig` **chỉ còn trên dòng mượn slot** (`slotBorrow != null`). Dòng bình thường lấy đơn vị từ `[unit].unitConfig` (giống hệt). `lentSlotRows[]` vẫn có `unitConfig`. Thay cho mô tả ở mục Việc 4.

### Không đổi

`GET /api/deliveries/queue` giữ nguyên dạng rút gọn public (quyết định 6c: chỉ đổi socket).

---

## 2026-11-18 — Cắt trường không dùng khỏi API (Việc 6, phần 1)

Các endpoint dưới đây chuyển từ "trả cả hàng database" sang danh sách trường cố định. Trường không có trong danh sách **không còn được trả**.

### BREAKING — `GET /api/dashboard/dispatch`

- **Bỏ** `[unit].slots` (danh sách slot của đơn vị). Popup chọn slot dùng `GET /api/deliveries/:id/borrowable-slots`; thống kê slot vẫn có trong `[unit].insights.stats`.
- `[unit].active[]` chỉ còn: `id`, `registrationCode`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `vendorName`, `driverName`, `driverPhone`, `poNumber`, `requestedTime`, `checkinTime`, `calledTime`, `receivingStartTime`, `createdAt`, `callCount`, `slotBorrow`, `unitConfig`, `assignedSlot { id, name, vehicleType, zone { id, code, name, unitConfigId, unitConfig } }`.
  - Đã bỏ: `vendorCode`, `note`, `cancelReason`, `completedTime`, `autoWarehouse`, `originalGoodsType`, `unitGoodsTypeId`, `updatedAt` và các cột khác; trong `assignedSlot` bỏ `code`, `acceptedGoods`, `goodsPriority`, `autoAssign`, `maxCapacity`, `status`, `isActive`, `currentDeliveryId`, `lastUsedAt`.
  - Cần các trường đã bỏ của một chuyến thì gọi `GET /api/deliveries/:id`.
- `[unit].upcoming[]` chỉ còn: `id`, `registrationCode`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `vendorName`, `requestedTime`, `createdAt`.

### BREAKING — `GET /api/slots`, `GET /api/slots/all`, socket `slot_updated`

- Mỗi slot: `id`, `name`, `assignedUnit`, `vehicleType`, `acceptedGoods`, `goodsPriority`, `autoAssign`, `maxCapacity`, `status`, `isActive`, `lastUsedAt`, `zoneId`, `zone { id, code, name, unitConfig }`, `deliveries[]`. **Bỏ** `code`, `currentDeliveryId`.
- `deliveries[]` (REST, cần đăng nhập): `id`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `vendorName`, `checkinTime`, `calledTime`, `receivingStartTime`, `createdAt`. Socket `slot_updated` vẫn chiếu tiếp qua allow-list public (không có `vendorName`).
- `GET /api/zones`: `slots[]` bỏ `code`.

### BREAKING — `GET /api/deliveries/:id`

Chỉ còn: `id`, `registrationCode`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `vendorName`, `driverName`, `driverPhone`, `poNumber`, `note`, `cancelReason`, `requestedTime`, `createdAt`, `checkinTime`, `calledTime`, `receivingStartTime`, `completedTime`, `callCount`, `unitConfig`, `assignedSlot { id, name, vehicleType, zone { id, code, name } }` (mới có `zone`). Bỏ các cột còn lại (`vendorCode`, `autoWarehouse`, `originalGoodsType`, `unitGoodsTypeId`, `updatedAt`, …) và cột nội bộ của slot.

### BREAKING — `GET /api/track/:code`, socket `track_updated`

Chỉ còn: `id`, `registrationCode`, `status`, `vehiclePlate`, `vehicleType`, `goodsType`, `autoWarehouse`, `receivingUnit`, `unitConfigId`, `ticketNumber`, `vendorName`, `driverName`, `driverPhone`, `poNumber`, `note`, `requestedTime`, `checkinTime`, `calledTime`, `receivingStartTime`, `completedTime`, `createdAt`, `updatedAt`, `assignedSlotId`, `unitConfig { …, truckSlotMinutes, motorbikeSlotMinutes, businessLocation { locationName } }`, `assignedSlot { id, name, vehicleType, zone { id, code, name, unitConfig } }`, cùng các trường tính sẵn `notificationCalledAt`, `locationName`, `queueInfo`. Bỏ `vendorCode`, `cancelReason`, `originalGoodsType`, `unitGoodsTypeId` và cột nội bộ của slot.

### BREAKING — socket `delivery_called`

Bỏ `slotCode`. Dùng `slotName` để hiển thị.

---

## 2026-11-18 — Bảng tình trạng vị trí cho waiting screen (Việc 5)

### Mới — `GET /api/waiting-screen/board` (public)

Query bắt buộc `businessLocationId` hoặc `unitConfigId`; thiếu trả `400 { "error": "MissingScope" }`. Giới hạn `publicReadLimiter` (240 request/phút/IP). Không có trường cá nhân.

Quy tắc **R1 — mỗi xe một dòng**: mỗi chỗ của slot (theo `maxCapacity`) là một phần tử trong `slotRows`. Server đã tính sẵn trạng thái từng dòng, app chỉ cần vẽ.

```json
{
  "businessLocationId": "…",
  "generatedAt": "2026-11-18T02:00:00.000Z",
  "units": [
    {
      "unitConfigId": "…",
      "unit": "THISKYHALL",
      "slotRows": [
        { "slotId": "…", "slotName": "Vị trí T1", "vehicleType": "TRUCK", "capacity": 1, "overCapacity": false,
          "state": "FOREIGN",
          "occupant": { "deliveryId": "…", "ticketCode": "EMART-T007", "vehiclePlate": "1154", "status": "CALLED", "unit": "EMART", "unitConfigId": "…" } },
        { "slotId": "…", "slotName": "Vị trí T3", "vehicleType": "MOTORBIKE", "capacity": 5, "overCapacity": false,
          "state": "EMPTY", "occupant": null }
      ],
      "borrowedRows": [],
      "waiting": [
        { "deliveryId": "…", "ticketCode": "THISKYHALL-M001", "vehiclePlate": "…", "vehicleType": "MOTORBIKE", "goodsType": "FRESH_FOOD", "checkinTime": "…" }
      ],
      "waitingTotal": { "MOTORBIKE": 1 }
    }
  ]
}
```

- `state` (nhìn từ đơn vị `unit`): `EMPTY` trống, `CALLED` xe của đơn vị đang được gọi vào, `RECEIVING` xe của đơn vị đang nhận hàng (gồm kho tự động), `FOREIGN` xe đơn vị khác đang mượn chỗ (mọi trạng thái), `UNAVAILABLE` chỗ trống của slot `MAINTENANCE`/`RESERVED`.
- `slotRows` sắp theo slot; trong mỗi slot, dòng có xe trước (gọi trước đứng trước), dòng trống sau. Số dòng mỗi slot = `max(capacity, số xe)`; `overCapacity = true` khi số xe vượt sức chứa.
- `borrowedRows`: xe của đơn vị này đang ở slot đơn vị khác (`lenderUnitConfigId`, `lenderUnit`), `state` luôn `FOREIGN`. Vẽ ở cuối danh sách, sau các dòng slot chính.
- `waiting`: tối đa **10 xe đầu hàng chờ cho mỗi `vehicleType`**, theo thứ tự check-in. `waitingTotal` là tổng thật theo loại xe.
- `ticketCode` đã format sẵn (prefix = `shortName` → `displayName` → mã unit, cùng quy tắc với web).
- Tên/logo/màu đơn vị vẫn lấy từ `GET /api/brand`, ghép theo `unit`.

### Mới — socket `waiting_board_updated`

Payload giống hệt response `GET /api/waiting-screen/board`. Phát vào phòng `waiting-screen:{businessLocationId}` (join bằng `realtime:join` với `{ businessLocationId, waitingScreen: true }`), sau mỗi thay đổi queue/slot, gom 400 ms theo khu vực. App nên gọi lại `GET /api/waiting-screen/board` khi socket kết nối lại.

### Không đổi

`GET /api/deliveries/queue` và `queue_updated` vẫn giữ (định dạng rút gọn từ Việc 0) cho app cũ. Web waiting screen không còn dùng hai kênh này. Có ngừng hỗ trợ hay không sẽ quyết ở Việc 6.

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
