# Luồng Check-in Chuẩn

## Mục Tiêu

Check-in chuẩn hiện nên đi qua route `/check-in` trên frontend và các endpoint rõ ràng trong `/api/deliveries`.

Role `CHECKIN` chỉ làm nhiệm vụ:

- Tìm lượt đăng ký bằng QR/registration code hoặc biển số.
- Check-in tài xế từ `REGISTERED` sang `WAITING`.

## Khung Giờ Được Check-in

`DeliveryTimeWindow` (Backoffice > UnitsTab, theo `UnitConfig` và loại hàng) chỉ dùng để chặn check-in; đăng ký, gọi xe, mượn slot và nhận hàng không phụ thuộc khung giờ. Logic nằm ở `backend/src/services/deliveryWindowPolicy.ts` và được gọi trong transaction của `checkInDelivery()`, nên áp dụng cho mọi đường check-in.

- Lấy các khung **đang bật** của `UnitConfig` và loại hàng tài xế chọn khi đăng ký (`originalGoodsType`, fallback `goodsType`; lượt kho tự động dùng loại hàng gốc). Khung lỗi dữ liệu (giờ bắt đầu >= kết thúc) bị bỏ qua.
- Không có khung nào bật: check-in cả ngày. Vận hành tắt các khung trong Backoffice để mở check-in tự do (ví dụ dịp lễ).
- Giờ Việt Nam hiện tại nằm trong ít nhất một khung (tính cả hai đầu): check-in bình thường. Tới sớm hay quá giờ đều bị chặn.
- Ngoài khung: trả `422 OutsideDeliveryWindow`, message `Quá khung giờ giao hàng quy định`, kèm `deliveryWindows` (ví dụ `06:00–08:00, 14:00–16:00`) và `canOverride`.
  - `CHECKIN`: `canOverride = false`, màn `/check-in` hiển thị lỗi kèm khung giờ quy định.
  - `ADMIN_OPE`, `ADMIN_LOC`, `SUPERADMIN`: `canOverride = true`, màn `/check-in` hiện popup "Xe giao hàng không trong khung giờ quy định, vẫn tiếp tục nhận hàng không?" với nút **Đồng ý** (primary) gửi lại kèm `overrideDeliveryWindow: true` và nút **Huỷ bỏ** (danger) giữ nguyên lượt `REGISTERED`.
  - Check-in được xác nhận ghi `deliveryWindowOverride: true` và `deliveryWindows` vào metadata của event `CHECKED_IN` và audit `delivery.check_in`.
- Sau khi check-in, khung giờ không còn ảnh hưởng: xe `WAITING` vẫn được gọi và nhận hàng dù khung đã hết.

## Frontend

File:

- `frontend/src/pages/CheckIn.tsx`: page layout gốc, compose các phần của màn check-in.
- `frontend/src/features/check-in/api.ts`: API helper cho lookup/check-in và waiting list.
- `frontend/src/features/check-in/hooks/useCheckIn.ts`: state và orchestration cho form, result, waiting list, export.
- `frontend/src/features/check-in/components/*`: form, result card, unit badge và waiting list.
- `frontend/src/features/check-in/utils.ts`: formatter ticket, unit metadata và dữ liệu CSV.

API đang dùng:

- `PATCH /api/deliveries/check-in-lookup`
- `GET /api/deliveries?status=REGISTERED` và `GET /api/deliveries?status=WAITING`.

Chức năng:

- Quét/nhập mã đăng ký.
- Tìm bằng biển số.
- Check-in lượt hợp lệ.
- Xem danh sách đăng ký của ngày hiện tại theo giờ Việt Nam và danh sách xe đã check-in đang chờ gọi (`WAITING`), theo thứ tự check-in. Xe đã được gọi và mọi trạng thái khác không xuất hiện trong danh sách này.
- Export CSV danh sách xe đã check-in đang chờ gọi.
- Sau khi đăng nhập, `CHECKIN` đi tới `/check-in`; các route nội bộ khác không cho role này truy cập, còn các route public vẫn sử dụng bình thường.
- Label/màu/ticket prefix đơn vị trên kết quả check-in và danh sách waiting đi qua `frontend/src/lib/unitPresentation.ts`, ưu tiên `delivery.unitConfig` và fallback generic theo `receivingUnit` nếu payload legacy thiếu metadata.

Route:

- `/check-in` trong `frontend/src/App.tsx`.
- Role được vào: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
- `RECEIVING` không được vào `/check-in`.

## Backend

Files:

- `backend/src/routes/deliveries.ts`: controller mỏng cho endpoint `/api/deliveries/*`.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: parse payload check-in lookup và các payload delivery khác.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery/queue và attach call count.
- `backend/src/modules/deliveries/deliveryService.ts`: điều phối check-in lookup, check-in by id, scope/unit-permission, audit, socket emit, track realtime và trigger auto-assign.
- `backend/src/services/checkInDelivery.ts`
- `backend/src/services/ticketSequence.ts`

API:

- `PATCH /api/deliveries/check-in-lookup`
  - Tìm delivery bằng `registrationCode` hoặc `vehiclePlate`.
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
  - Check delivery đúng ngày giao.
  - Gọi `checkInDelivery()`.
  - Nếu `registrationCode` là mã đã bị thay thế do tài xế đăng ký lại (xem `driver-registration.md`), trả `409 RegistrationSuperseded` với thông báo gồm thời điểm thay thế, mã hiện hành và số lần đăng ký của biển số trong ngày; nhân viên tra theo biển số hoặc dùng mã mới.
  - Tra theo biển số chấp nhận cả cách gõ có dấu `-`, `.` hoặc khoảng trắng.
  - Body có thể gửi `overrideDeliveryWindow: true` để xác nhận check-in ngoài khung giờ (chỉ có hiệu lực với `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`).
  - Emit realtime và trigger auto-assign.
- `PATCH /api/deliveries/:id/check-in`
  - Check-in bằng id.
  - Role như trên; body tùy chọn `{ overrideDeliveryWindow: true }` như lookup.

Service:

- `checkInDelivery()`
  - Lock row delivery.
  - Nếu đã `WAITING`, trả lại kết quả idempotent, không cấp lại ticket.
  - Nếu `REGISTERED`, chuyển sang `WAITING`, set `checkinTime`, cấp `ticketNumber`.
  - Trước khi cấp số, kiểm tra lại NCC kho tự động theo unit của lượt và cập nhật loại hàng dựa trên loại gốc. Lượt kho tự động cũ không có loại gốc và NCC không còn hợp lệ bị từ chối check-in để tránh tự đoán loại hàng; xem `auto-warehouse.md`.
  - Ghi event `CHECKED_IN` trong `delivery_history_events`.
- `reserveTicketNumber()`
  - Cấp ticket atomic theo ngày VN + receiving unit + vehicle type.
  - Backend vẫn lưu sequence theo snapshot `receivingUnit + vehicleType + ngày` để tương thích số thẻ đã cấp; frontend format hiển thị bằng metadata unit khi API trả đủ `unitConfig`.

## Scope Unit Động

Delivery mới từ `/register` có `unitConfigId`. Với các delivery này, check-in dùng `unitConfigId` làm khóa scope chính:

- `getScopeForDelivery()` ưu tiên `assignedSlot`, sau đó tới `delivery.unitConfigId`, cuối cùng mới fallback legacy theo default location + `receivingUnit`.
- `ensureDeliveryAccess()` kiểm `businessLocationId` từ scope đã resolve.
- `assertUnitPermission()` so quyền thao tác bằng `UserUnitPermission.unitConfigId` khi delivery có `unitConfigId`.
- `GET /api/deliveries?status=WAITING` lọc danh sách theo các `unitConfigId` trong scope hiện tại; nếu scope không resolve ra unit nào thì trả danh sách rỗng.
- Response check-in và waiting list include `unitConfig` rút gọn gồm `id`, `unit`, `businessLocationId`, `displayName`, `shortName`, `icon`, `logoUrl`, `primaryColor` để frontend không phải hardcode label/brand unit.

Fallback legacy:

- Nếu delivery cũ chưa có `unitConfigId`, backend vẫn có thể fallback theo `receivingUnit` trong `BusinessLocation` mặc định để tránh làm chết dữ liệu cũ.
- Đây không phải hướng runtime chính cho dữ liệu mới.

## Quyền Hiện Tại

Đúng:

- `CHECKIN` không được call/start/complete/cancel delivery trong `/api/deliveries`.
- `RECEIVING` không được vào `/check-in` trên frontend.
- `CHECKIN` chỉ được check-in delivery thuộc unit config đã được gán trong `user_unit_permissions`.
- Multi-unit allowlist cho `CHECKIN`, `RECEIVING`, `ADMIN_LOC`, `ADMIN_OPE` được quản lý bằng `UserUnitPermission` theo `unitConfigId`.
- Audit check-in hiện ghi actor từ user đang đăng nhập qua `userActor(req.user)`.
