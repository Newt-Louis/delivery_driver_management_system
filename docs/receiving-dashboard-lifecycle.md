# Dashboard Nhận Hàng Và Lifecycle Giao Hàng

## Mục Tiêu

Dashboard là màn hình điều phối/nội bộ cho hàng đợi, gọi xe vào slot, bắt đầu nhận hàng, hoàn tất hoặc hủy lượt giao.

Lifecycle chuẩn:

1. `REGISTERED`
2. `WAITING`
3. `CALLED`
4. `RECEIVING` hoặc `AUTO_WAREHOUSE_RECEIVING`
5. `COMPLETED`
6. `CANCELLED`
7. `EXPIRED`

## Frontend

File:

- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/GoodsBadge.tsx`

API:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/dispatch`
- `POST /api/deliveries/auto-dispatch/:unit`
- `PATCH /api/deliveries/:id/call`
- `PATCH /api/deliveries/:id/start-receiving`
- `PATCH /api/deliveries/:id/complete`
- `PATCH /api/deliveries/:id/cancel`
- `POST /api/dashboard/expire-stale`

Socket events lắng nghe:

- `queue_updated`
- `slot_updated`
- `delivery_completed`
- `delivery_called`

## Backend

Files:

- `backend/src/routes/dashboard.ts`
- `backend/src/routes/deliveries.ts`
- `backend/src/services/manualCallDelivery.ts`
- `backend/src/services/deliveryLifecycle.ts`
- `backend/src/services/slotState.ts`
- `backend/src/services/autoAssign.ts`

API lifecycle:

- `PATCH /api/deliveries/:id/call`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Gọi `manualCallDelivery()`.
  - Tạo `CallLog` khi có call mới.
  - Emit `delivery_called`, `queue_updated`, `slot_updated`.
- `PATCH /api/deliveries/:id/start-receiving`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - `CALLED -> RECEIVING` hoặc `AUTO_WAREHOUSE_RECEIVING`.
- `PATCH /api/deliveries/:id/complete`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Gọi `completeDelivery()`.
  - Release slot và trigger auto-assign tiếp.
- `PATCH /api/deliveries/:id/cancel`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Gọi `cancelDelivery()`.
  - Release slot nếu cần.

Service:

- `manualCallDelivery()`
  - Lock delivery.
  - Lock slot.
  - Validate slot active, đúng unit, đúng vehicle type, còn capacity.
  - Idempotent nếu delivery đã được call vào đúng slot.
- `completeDelivery()`
  - Lock delivery.
  - Chuyển `COMPLETED`.
  - Release/reconcile slot.
- `cancelDelivery()`
  - Chuyển `CANCELLED`.
  - Release/reconcile slot.
- `reconcileSlotState()`
  - Tính lại slot `AVAILABLE`/`OCCUPIED` theo active delivery count.

## Quyền

- `CHECKIN` không được gọi call/start/complete/cancel.
- `RECEIVING` được thực hiện receiving lifecycle.
- `ADMIN_OPE` được điều phối và xử lý sự cố.

## Lưu Ý

- Flow chuẩn nên dùng các endpoint rõ ràng trong `/api/deliveries`.
