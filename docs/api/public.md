# API Public (Không Cần Đăng Nhập)

Quy ước chung, mã lỗi, rate limit: xem [README.md](README.md).

## Khu Vực Và Brand

### `GET /api/units/public/business-locations`

Danh sách khu vực (`BusinessLocation`) đang hoạt động, để app cho người dùng chọn khu vực trước khi xem màn hình chờ, đăng ký hoặc tra cứu.

### `GET /api/brand?businessLocationId=…`

Brand của khu vực và các đơn vị đang hoạt động:

```json
{
  "mall": { "id": "…", "code": "…", "mallName": "THISO Phan Văn Trị", "logoUrl": null, "tagline": "…" },
  "units": {
    "EMART": { "id": "…", "unit": "EMART", "displayName": "Emart", "shortName": "Emart", "icon": "", "logoUrl": null, "primaryColor": "#…" }
  }
}
```

`units` có key là mã đơn vị (`unit`). Màn hình chờ dùng key này để ghép với `units[].unit` của board.

### `GET /api/units/public/configs?businessLocationId=…`

Cấu hình public của các đơn vị trong khu vực (đã bỏ khoá API). Dùng cho form đăng ký.

### `GET /api/units/:unit/config?businessLocationId=…|unitConfigId=…`

Cấu hình public của một đơn vị.

### `GET /api/units/:unit/goods-types`

Loại hàng tuỳ biến của đơn vị.

### `GET /api/units/:unit/vehicle-availability?goodsType=…&unitGoodsTypeId=…&businessLocationId=…`

Đơn vị còn nhận loại xe nào cho loại hàng đã chọn (dùng ở bước chọn loại xe khi đăng ký). `goodsType` bắt buộc.

### `GET /api/units/:unit/vendors`, `GET /api/units/:unit/po`, `GET /api/units/order-codes`

Tra cứu nhà cung cấp / PO / mã đơn qua tích hợp của đơn vị, phục vụ form đăng ký. Tham số theo `backend/src/modules/units/unitFormRequest.ts`.

## Đăng Ký Giao Hàng

### `POST /api/deliveries/quick-verify`

Body `{ "code": "<mã PO hoặc mã Thi Công>" }`. Kiểm tra mã cho luồng đăng ký nhanh; trả token xác minh dùng ở `quickVerificationToken` khi đăng ký.

### `POST /api/deliveries/manual-registration-code`

Không body. Trả `{ "code": "…", "deliveryDate": "YYYY-MM-DD" }`, mã tham chiếu cho một phiên đăng ký thủ công. HTTP 201.

### `POST /api/deliveries/register`

HTTP 201. Body:

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| `driverPhone` | có | 10 số |
| `vehiclePlate` | có | biển số VN viết liền |
| `vehicleType` | có | `TRUCK` \| `MOTORBIKE` |
| `receivingUnit` | có | mã đơn vị |
| `goodsType` | có | `GoodsType` |
| `businessLocationId` hoặc `unitConfigId` | nên có | xác định khu vực/đơn vị |
| `driverName`, `vendorName`, `vendorCode`, `poNumber`, `note`, `unitGoodsTypeId` | không | |
| `deliveryDate` | không | `YYYY-MM-DD`; hệ thống chỉ vận hành trong ngày |
| `quickVerificationToken` | khi đăng ký nhanh | từ `quick-verify` |
| `manualRegistration` | không | `true` cho luồng thủ công |
| `clientDevice` | không | `{ "mobile": true }` |

Response: chuyến vừa tạo, có `registrationCode` (mã để theo dõi/check-in). Lỗi thường gặp: 409 biển số đã có lượt trong ngày, 400 sai định dạng biển số/SĐT.

## Theo Dõi Chuyến (Tài Xế)

### `GET /api/track/search?plate=…&businessLocationId=…`

Tìm mã đăng ký theo biển số. Trả `{ "registrationCode": "…" }`. 404 không có lượt; 409 biển số có lượt ở nhiều khu vực (cần truyền `businessLocationId`).

### `GET /api/track/:code`

Chi tiết chuyến cho tài xế. Ai có `registrationCode` thì xem được, nên coi mã này như mật khẩu của chuyến. Trường trả về (từ 2026-11-18):

`id`, `registrationCode`, `status`, `vehiclePlate`, `vehicleType`, `goodsType`, `autoWarehouse`, `receivingUnit`, `unitConfigId`, `ticketNumber`, `vendorName`, `driverName`, `driverPhone`, `poNumber`, `note`, `requestedTime`, `checkinTime`, `calledTime`, `receivingStartTime`, `completedTime`, `createdAt`, `updatedAt`, `assignedSlotId`,
`unitConfig { id, unit, businessLocationId, displayName, shortName, icon, logoUrl, primaryColor, truckSlotMinutes, motorbikeSlotMinutes, businessLocation { locationName } }`,
`assignedSlot { id, name, vehicleType, zone { id, code, name, unitConfig } } | null`,
`notificationCalledAt` (lần gọi/gọi lại gần nhất), `locationName`,
`queueInfo` (chỉ khi `WAITING`): `{ position, totalWaiting, estimatedWaitMinutes, availableSlots, avgReceivingMinutes, sampleCount, confidence, estimatedCallTime }`.

Realtime: join phòng `track:{code}` (xem [realtime.md](realtime.md)) để nhận `track_updated` cùng payload này.

### `POST /api/track/active-session`

Body `{ "codes": ["…"] }`. Trả `{ "activeCode": "…" | null }`: chuyến còn hoạt động trong danh sách mã app đang lưu.

## Web Push

- `GET /api/push/vapid-public-key`: khoá VAPID public.
- `POST /api/push/subscribe`: body `{ "subscription": <PushSubscription JSON>, "deliveryCode": "<registrationCode>" }`. 409 khi chuyến không còn nhận thông báo.
- `DELETE /api/push/unsubscribe`: huỷ đăng ký.

## Màn Hình Chờ (TV)

### `GET /api/waiting-screen/board?businessLocationId=…` (hoặc `?unitConfigId=…`)

**Dùng API này cho TV.** Thiếu scope trả `400 { "error": "MissingScope" }`. Không có dữ liệu cá nhân.

Quy tắc R1 (mỗi xe một dòng): mỗi chỗ của slot (theo sức chứa) là một phần tử `slotRows`; server tính sẵn trạng thái từng dòng.

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

| `state` | Ý nghĩa (nhìn từ đơn vị `unit`) | Màu web dùng |
|---|---|---|
| `EMPTY` | chỗ trống | xanh lá (success) |
| `CALLED` | xe của đơn vị đang được gọi vào | primary |
| `RECEIVING` | xe của đơn vị đang nhận hàng (gồm kho tự động) | đỏ (error) |
| `FOREIGN` | xe đơn vị khác đang mượn chỗ (mọi trạng thái) | vàng gold |
| `UNAVAILABLE` | chỗ trống của slot đang bảo trì/đặt trước | xám, hiển thị "Tạm ngưng" |

- `slotRows` sắp theo slot; trong một slot dòng có xe trước (gọi trước đứng trước), dòng trống sau. Số dòng mỗi slot = `max(capacity, số xe)`; `overCapacity = true` khi số xe vượt sức chứa.
- `borrowedRows`: xe của đơn vị này đang ở slot đơn vị khác (`lenderUnitConfigId`, `lenderUnit`), luôn `FOREIGN`; hiển thị sau các dòng slot chính, ví dụ "T1 · Thiskyhall".
- `waiting`: tối đa 10 xe đầu hàng chờ **mỗi loại xe**; `waitingTotal` là tổng thật.
- Tên/logo/màu đơn vị lấy từ `GET /api/brand`, ghép theo `unit`.

Realtime: join phòng màn hình chờ, nhận `waiting_board_updated` (cùng payload) và `delivery_called` (làm nổi xe vừa gọi). Xem [realtime.md](realtime.md).

### `GET /api/deliveries/queue?businessLocationId=…` (giữ cho app cũ)

Mảng chuyến đang hoạt động, dạng rút gọn public: `id`, `status`, `ticketNumber`, `vehiclePlate`, `vehicleType`, `goodsType`, `receivingUnit`, `unitConfigId`, `assignedSlotId`, `checkinTime`, `calledTime`, `receivingStartTime`, `createdAt`, `callCount`, `unitConfig`, `assignedSlot { id, name, vehicleType, zone }`. Không có tên/SĐT tài xế, NCC, PO, ghi chú, `registrationCode`.

App mới nên dùng `GET /api/waiting-screen/board`. Lưu ý: gọi không kèm `businessLocationId` hiện trả hàng chờ của mọi khu vực.
