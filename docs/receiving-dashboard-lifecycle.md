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

- `frontend/src/pages/Dashboard.tsx`: route wrapper.
- `frontend/src/features/dashboard/Dashboard.tsx`: implementation.
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/GoodsBadge.tsx`

Ghi chú kiến trúc frontend:

- Dashboard implementation hiện nằm trong feature folder để page route mỏng hơn.
- Tab `Tất cả` aggregate từ các unit backend trả về.
- Unit label/icon/color/ticket prefix dùng `frontend/src/lib/unitPresentation.ts`, ưu tiên metadata từ `UnitConfig` trong payload backend.
- Dashboard không còn tự dựng UI bằng danh sách unit demo cố định; backend trả unit nào trong scope thì frontend sinh tab/card tương ứng.

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
- `backend/src/routes/deliveries.ts`: controller mỏng cho lifecycle endpoint.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: parse payload call/cancel/register/check-in.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery, queue, slot list và scope unit.
- `backend/src/modules/deliveries/deliveryService.ts`: điều phối call/start/complete/cancel, scope/unit permission, audit, socket emit, track realtime, push và archive.
- `backend/src/services/manualCallDelivery.ts`
- `backend/src/services/deliveryLifecycle.ts`
- `backend/src/services/slotState.ts`
- `backend/src/services/autoAssign.ts`

`GET /api/dashboard/summary` và `GET /api/dashboard/dispatch` resolve danh sách `UnitConfig` theo scope của request:

- `businessLocationId` lấy từ `enforceScope`.
- Với role có unit operation scope, danh sách unit được lọc theo `req.user.operationUnits`.
- Với `SUPERADMIN` ngoài `/superadmin`, danh sách unit lấy từ selected operational context trong Redis session.
- Response dispatch là record theo unit code để giữ compatibility với frontend cũ, nhưng mỗi unit payload có thêm `unitConfig` để UI mới render tab/card động.
- Delivery chưa assigned slot được scope bằng `delivery_registrations.unit_config_id`. Legacy row thiếu `unitConfigId` không phải nguồn scope an toàn khi nhiều location có thể trùng unit code, nên cần được migrate/map trước khi kỳ vọng xuất hiện trong dashboard dynamic.

Backend không build dashboard bằng mảng enum unit cố định. Nếu user không có unit scope hợp lệ, summary count trả 0 và dispatch không có unit nào.

API lifecycle:

- `PATCH /api/deliveries/:id/call`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Gọi `manualCallDelivery()`.
  - Tạo event timeline trong `delivery_history_events` khi gọi mới, gọi lại hoặc đổi slot.
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
  - Bắt buộc có lý do hủy.
  - Gọi `cancelDelivery()`.
  - Release slot nếu cần.
- `POST /api/deliveries/public-cancel`
  - Public route dành cho tài xế tự hủy tại `/cancelled`.
  - Đối chiếu đúng 5 thông tin: biển số xe, số điện thoại, mã PO/Thi Công, mã đăng ký, ngày giờ giao.
  - Sai bất kỳ thông tin nào trả message chung để tránh lộ dữ liệu.
  - Khi đúng, hủy với lý do `Tài xế thao tác hủy`, ghi history/events, reconcile slot và xóa row operational.

Service:

- `manualCallDelivery()`
  - Lock delivery.
  - Lock slot.
  - Validate slot active, đúng vehicle type, còn capacity.
  - Cùng đơn vị: slot có thể nhận theo `maxCapacity`.
  - Khác đơn vị: chỉ cho mượn khi slot trống hoàn toàn, cùng business location, và hiện tại không nằm trong khung giờ nhận hàng enabled của đơn vị sở hữu slot.
  - Không cho gọi vào slot `MAINTENANCE`/`RESERVED`.
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
- `ADMIN_OPE` không chỉnh cấu hình Backoffice; dashboard/docks là bề mặt làm việc chính của role này.
- Mọi action delivery/slot phải enforce `unitConfigId` hoặc resolve được unit từ delivery/slot trước khi cho thao tác.

## Lưu Ý

- Flow chuẩn nên dùng các endpoint rõ ràng trong `/api/deliveries`.
