# Tự Động Điều Phối Xe Vào Slot

## Mục Tiêu

Auto assign tự động gọi xe đang `WAITING` vào slot phù hợp khi slot còn capacity. Hệ thống có thể trigger sau:

- Check-in thành công.
- Complete delivery.
- Cancel delivery.
- Nút auto-dispatch trên dashboard.
- Lúc backend startup drain backlog.

## Backend

File chính:

- `backend/src/services/autoAssign.ts`

API trigger:

- `POST /api/deliveries/auto-dispatch/:unit`

Hàm chính:

- `triggerAutoAssign(unit, scope)`
  - Tìm slot active, autoAssign, không `MAINTENANCE`/`RESERVED`.
  - Lọc theo scope nếu có `businessLocationId`/`unitConfigId`.
  - Chọn slot còn capacity.
  - Lặp cho đến khi hết capacity hoặc không còn xe phù hợp.
- `assignNextDeliveryToSlot(slotId, unit)`
  - Transaction.
  - Lock slot bằng `FOR UPDATE`.
  - Count active deliveries trong slot.
  - Tìm delivery `WAITING` bằng `FOR UPDATE SKIP LOCKED`.
  - Update delivery sang `CALLED`.
  - Tạo event `AUTO_ASSIGNED` trong `delivery_history_events`.
  - Reconcile slot.
- `findNextWaitingDeliveryForSlot(tx, slot)`
  - Chọn xe theo unit + vehicle type.
  - Áp dụng filter hàng hóa theo slot.
  - Ưu tiên `FRESH_FOOD` nếu slot có thể nhận fresh food.
- `emitAutoAssignResult(result, unit)`
  - Ghi audit.
  - Emit socket.
  - Gửi web push.
  - Emit track update.

## Rule Nghiệp Vụ

- Slot `autoWarehouseOnly = true` chỉ nhận `AUTO_WAREHOUSE`.
- Slot thường không nhận `AUTO_WAREHOUSE`.
- `FRESH_FOOD` được ưu tiên trong slot thường nếu slot chấp nhận.
- `maxCapacity` cho phép nhiều xe trong một slot, đặc biệt xe máy.
- `MAINTENANCE` và `RESERVED` không được auto assign.

## Concurrency

Đã có các cơ chế tránh race condition:

- Lock slot `FOR UPDATE`.
- Delivery chọn bằng `FOR UPDATE SKIP LOCKED`.
- Recheck active count sau khi lock.
- Reconcile slot sau assign.

## Realtime Và Push

Sau khi assign:

- Emit `delivery_called`.
- Emit `queue_updated`.
- Emit `slot_updated`.
- Gửi push `delivery-called`.
- Update track room tương ứng.
- `callCount` được tính từ các event gọi xe trong `delivery_history_events`.
