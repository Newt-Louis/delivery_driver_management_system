# API Changelog

Nhật ký thay đổi hợp đồng API (REST) và socket event, dành cho người làm app điện thoại, TV và PDA.

Quy ước:

- Mỗi mục ghi ngày, endpoint/event bị ảnh hưởng, thay đổi cụ thể và việc app cần làm.
- **BREAKING** = app đang đọc trường/endpoint đó sẽ hỏng hoặc hiển thị sai nếu không sửa.
- Mục mới nhất nằm trên cùng.

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

Payload vẫn là mảng slot đang hoạt động, mỗi slot gồm: `id`, `name`, `code`, `vehicleType`, `status`, `assignedUnit`, `zoneId`, `maxCapacity`, `isActive`, `autoAssign`, `autoWarehouseOnly`, `zone { id, code, name, unitConfigId, unitConfig }`, `deliveries[]`.

`deliveries[]` của mỗi slot giờ dùng **cùng định dạng rút gọn** như `queue_updated`; các trường tài xế/NCC/PO/note/`registrationCode` đã bị bỏ. Web dashboard và docks chỉ dùng event này làm tín hiệu tải lại, không đọc payload.

### Không đổi định dạng — `GET /api/dashboard/dispatch` (cần đăng nhập)

`active[].assignedSlot.zone.unitConfig` trước đây trả **toàn bộ cột** của `UnitConfig`, kể cả `vendorApiKey` và `poApiKey`. Giờ chỉ còn `id`, `unit`, `displayName`, `shortName`, `icon`, `logoUrl`, `primaryColor`, `businessLocationId`. App không được phụ thuộc vào hai trường API key.
