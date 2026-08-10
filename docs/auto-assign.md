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
  - Mỗi vòng query lại slot còn capacity theo active delivery count hiện tại và `Slot.maxCapacity`.
  - Assign một xe thành công rồi query lại vòng tiếp theo, tránh dừng sớm khi snapshot slot/count bị cũ.
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
  - Ưu tiên theo `Slot.goodsPriority`; slot cũ chưa cấu hình priority fallback theo thứ tự `FRESH_FOOD`, `GENERAL_GOODS`, `THI_CONG`.
  - Trong cùng một loại hàng, xe được gọi FIFO theo `checkinTime`, sau đó `createdAt`.
- `emitAutoAssignResult(result, unit)`
  - Ghi audit.
  - Emit socket.
  - Gửi web push.
  - Emit track update.

## Rule Nghiệp Vụ

- Slot `autoWarehouseOnly = true` chỉ nhận `AUTO_WAREHOUSE`.
- Slot thường không nhận `AUTO_WAREHOUSE`.
- Slot thường chỉ nhận các loại nằm trong `acceptedGoods`; nếu `acceptedGoods` rỗng thì hiểu là nhận tất cả hàng thường.
- `goodsPriority` chỉ sắp thứ tự ưu tiên trong phạm vi hàng slot được nhận, không cho phép auto-assign đưa loại hàng không được nhận vào slot.
- `maxCapacity` cho phép nhiều xe trong một slot, đặc biệt xe máy.
- Tổng sức chứa của một unit/vehicle là tổng `Slot.maxCapacity` của các slot active phù hợp; ví dụ 5 slot xe tải, mỗi slot 2 chỗ, thì auto assign chỉ dừng khi đủ 10 active deliveries.
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
