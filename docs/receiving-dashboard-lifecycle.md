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

- `frontend/src/pages/Dashboard.tsx`: page layout gốc, compose header, alert, tabs, modal và tab content.
- `frontend/src/features/dashboard/api.ts`: API helper cho summary, dispatch, delivery detail và lifecycle action.
- `frontend/src/features/dashboard/hooks/useDashboard.ts`: state/orchestration cho query, socket invalidation, modal và lifecycle action.
- `frontend/src/features/dashboard/components/*`: modal, table/filter, unit/all tab view, KPI, alert và header.
- `frontend/src/features/dashboard/utils.ts`: formatter ticket/unit metadata, timeline, filter/sort và export rows.
- `frontend/src/components/StatusBadge.tsx`
- `frontend/src/components/GoodsBadge.tsx`

Ghi chú kiến trúc frontend:

- Dashboard page giữ layout gốc; feature folder chỉ chứa các trách nhiệm con để page compose lại.
- Tab `Tất cả` tổng hợp các unit backend trả về và có bốn ô: lượt đăng ký hôm nay, lượt check-in hôm nay, số dòng cảnh báo và số dòng xử lý gấp. Hai ô cảnh báo mở danh sách tương ứng; số đếm là số thông báo hiển thị, gồm cả dòng tổng hợp và dòng theo xe nên một xe có thể xuất hiện trong nhiều thông báo. Lỗi tải dữ liệu vẫn được hiển thị riêng ngay trên tab. Các tab đơn vị giữ cảnh báo và thao tác hiện có.
- Unit label/icon/color/ticket prefix dùng `frontend/src/lib/unitPresentation.ts`, ưu tiên metadata từ `UnitConfig` trong payload backend.
- Dashboard không còn tự dựng UI bằng danh sách unit demo cố định; backend trả unit nào trong scope thì frontend sinh tab tương ứng. Danh sách xe đang điều phối và đã đặt dùng Ant Table từ breakpoint `lg` và Collapse theo từng chuyến bên dưới `lg`; mỗi danh sách hiển thị 40 lượt đầu và tự mở thêm 40 khi cuộn gần cuối, có nút xem thêm dự phòng. Đây là phân đoạn hiển thị phía client: API vẫn trả toàn bộ dữ liệu. Bộ lọc hoặc chuyển đơn vị đặt lại số dòng; cập nhật realtime không đặt lại giới hạn đã mở.
- Danh sách điều phối hiển thị loại hàng và loại xe thành hai cột riêng; tên loại hàng được in đậm. Nút thao tác được xếp xuống dòng trong cột gọn hơn và nút xuất dữ liệu dùng màu xanh thành công.
- Không còn nút "Xem" và modal chi tiết. Click vào dòng (desktop) hoặc mở mục `Collapse` (mobile) để bung `DeliveryDetailPanel` ngay bên dưới. Panel chỉ hiển thị (nhà cung cấp, mã đăng ký, tài xế, điện thoại, loại xe/hàng, đơn vị nhận, số lần gọi, PO, ghi chú, lý do hủy, các mốc thời gian trong ngày, vị trí; không hiện "Ngày giao" vì hệ thống chỉ vận hành trong ngày), **không có timeline lịch sử và không có nút thao tác**; thao tác vẫn nằm trên dòng. Mỗi lần chỉ mở một dòng. Dòng có con trỏ dạng tay khi hover, dòng đang mở được tô nền `colorPrimaryBg`.
- Panel gọi `GET /api/deliveries/:id` khi được mở (một số trường như NCC, PO, note, các mốc thời gian không dùng cho bảng), query key `['delivery', id]`. Endpoint này không còn trả `historyEvents`; timeline xem ở trang Lịch sử. Socket `queue_updated`/`slot_updated`/`delivery_called`/`delivery_completed` invalidate cả `['delivery']`, nên panel đang mở tự cập nhật; panel đang đóng không gọi API.
- Nút "Mượn slot" (chỉ xe `WAITING`) mở `CallModal`. Popup gọi `GET /api/deliveries/:id/borrowable-slots` mỗi lần mở (query key `['borrowable-slots', id]`, được invalidate theo socket), hiển thị hai nhóm "Cùng đơn vị" và "Khác đơn vị" (kèm logo/tên đơn vị của slot; slot nhiều chỗ hiện thêm "đang có/sức chứa"). Không hiển thị slot khác loại xe. Gợi ý AI vẫn mở popup này với slot chọn sẵn; nếu slot đó không còn trống thì popup báo và bắt chọn lại. Dashboard không còn nút đổi slot cho xe đã `CALLED`.
- Nút "Gọi lại" (xe `CALLED`) không mở popup chọn slot: gọi thẳng `PATCH /api/deliveries/:id/call` với `slotId` = slot hiện tại của xe (`doRecall` trong `useDashboard`). Backend nhận diện là gọi lại (`outcome: 'recalled'`): ghi event `RECALLED`, emit `delivery_called`/`queue_updated`/`slot_updated`, gửi web push; không đổi trạng thái, slot hay `calledTime`. Nút chỉ bị khoá trong lúc request đang chạy; chưa có chống spam (TODO trong `useDashboard.doRecall` và `deliveryService.callDelivery`).
- Mỗi lần gọi lại là một event `RECALLED`, nên mốc đếm của job `auto-cancel-called-no-show` được tính lại từ lần gọi lại gần nhất. Tag "Chưa vào" trên dashboard và chỉ số `noShowRisk` vẫn tính từ `calledTime` (lần gọi đầu).
- Badge trên tab đếm các lượt trong danh sách đang điều phối của đơn vị (`WAITING`, `CALLED`, `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING`); tab `Tất cả` cộng các đơn vị trong scope. Số này không phụ thuộc bộ lọc hoặc giới hạn số dòng đang hiển thị, và không bao gồm lượt đã hủy, hoàn tất hay chưa check-in.

API:

- `GET /api/dashboard/summary`
- `GET /api/dashboard/dispatch`
- `POST /api/deliveries/auto-dispatch/:unit`
- `GET /api/deliveries/:id/borrowable-slots`
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

Hai số `totalRegisteredToday` và `totalCheckedInToday` của summary đếm theo ngày hiện tại của backend, theo thời điểm đăng ký hoặc check-in tương ứng. Nguồn gồm delivery vận hành và delivery history trong scope đơn vị, loại trùng theo `originalDeliveryId` khi bản vận hành còn tồn tại. Đăng ký mới phát `queue_updated` sau khi giao dịch thành công để dashboard làm mới; các socket và polling dự phòng hiện có tiếp tục hoạt động.

API lifecycle:

- `GET /api/deliveries/:id/borrowable-slots`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`. Người gọi phải có quyền trên **đơn vị của xe** (`ensureDeliveryAccess`); không cần quyền trên đơn vị sở hữu slot.
  - Chỉ cho xe `WAITING`; trạng thái khác trả 409.
  - Trả slot đang hoạt động, không `MAINTENANCE`/`RESERVED`, **cùng loại xe**, cùng `BusinessLocation`, chia hai nhóm theo đúng luật của `manualCallDelivery()`: `sameUnit` (`slot.assignedUnit === delivery.receivingUnit`, số xe đang chiếm < `maxCapacity`) và `otherUnits` (khác đơn vị, không có xe nào). Mỗi slot chỉ gồm `id`, `name`, `vehicleType`, `maxCapacity`, `activeCount`, `zone { id, code, name }`, `unitConfig` (trường hiển thị).
- `PATCH /api/deliveries/:id/call`
  - Role: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Quyền: cần quyền trên đơn vị của xe và slot phải cùng khu vực vận hành. **Không** kiểm tra quyền trên đơn vị sở hữu slot, vì mượn slot được thoả thuận ngoài thực tế, hệ thống không duyệt.
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
- Scheduler `auto-cancel-called-no-show`
  - Chỉ áp dụng cho delivery đang `CALLED` và unit bật `autoCancelCalledEnabled`.
  - Nếu quá `autoCancelCalledAfterMinutes` từ lần gọi/recall/chuyển slot gần nhất mà chưa vào `RECEIVING`, hệ thống tự gọi `cancelDelivery()` với lý do `Tài xế check-in rồi nhưng không vào`.
  - Sau khi hủy, slot được release, dashboard/docks/waiting screen/track nhận realtime update và auto-assign được trigger tiếp nếu còn xe phù hợp.

Service:

- `manualCallDelivery()`
  - Lock delivery.
  - Lock slot.
  - Validate slot active, cùng khu vực và còn capacity. API vẫn cho chỉ định xe vào slot khác loại xe (sức chứa kiểm tra dưới lock), nhưng giao diện dashboard chỉ đưa ra slot cùng loại xe.
  - Cùng đơn vị: slot có thể nhận theo `maxCapacity`.
  - Khác đơn vị: chỉ cho mượn khi slot trống hoàn toàn và cùng business location. Khung giờ giao hàng không ảnh hưởng việc gọi xe hay mượn slot.
  - Không cho gọi vào slot `MAINTENANCE`/`RESERVED`.
  - Chuyển loại xe tại slot chỉ do thao tác gọi thủ công; auto-assign vẫn dùng bộ lọc loại xe của slot và các quy tắc hàng hóa hiện có.
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
- Tab `Tất cả` chỉ hiển thị cho `ADMIN_LOC` và `SUPERADMIN`. `ADMIN_OPE` và `RECEIVING` bắt đầu tại đơn vị đầu tiên được cấp quyền và chỉ có các tab đơn vị trong phạm vi backend trả về; nếu không có đơn vị thì màn hình báo không có đơn vị được phân quyền. `ADMIN_LOC` vẫn chỉ tổng hợp các đơn vị trong operation scope của tài khoản, còn `SUPERADMIN` theo khu vực vận hành đã chọn.
- Mọi action delivery/slot phải enforce `unitConfigId` hoặc resolve được unit từ delivery/slot trước khi cho thao tác.

## Lưu Ý

- Flow chuẩn nên dùng các endpoint rõ ràng trong `/api/deliveries`.

## Xe Mượn Slot ("Mượn slot")

Bảng dashboard vốn là mỗi xe một dòng, khớp quy tắc R1 trong `business-location-unit-zone-slot.md`.

Quy tắc: **đơn vị** của một dòng là đơn vị tài xế giao hàng cho (`delivery.unitConfig`); **vị trí** là slot tài xế phải vào, có thể thuộc đơn vị khác. Ví dụ xe EMART được gọi vào M1 của THISO Mall: đơn vị EMART, vị trí M1.

Backend (`GET /api/dashboard/dispatch`):

- Mỗi dòng có `unitConfig` của chính xe (select an toàn) và `slotBorrow: { lenderUnitConfigId, borrowerUnitConfigId } | null` (khác null khi `assignedSlot.zone.unitConfigId !== delivery.unitConfigId`).
- `active` của một đơn vị chỉ gồm xe của đơn vị đó (kể cả xe đang mượn slot đơn vị khác). Badge tab, thống kê, cảnh báo và gợi ý AI chỉ tính `active`.
- `lentSlotRows` của một đơn vị: xe đơn vị khác đang chiếm slot của đơn vị này, có `isLentSlotRow: true`. Nếu người xem có quyền trên đơn vị của xe (đơn vị đó nằm trong danh sách tab của họ) thì dòng đầy đủ (`detailRestricted: false`); nếu không, dòng chỉ còn dạng rút gọn `toPublicDelivery` (biển số, số thẻ, đơn vị, vị trí, loại xe/hàng, trạng thái, thời gian) và `detailRestricted: true`.

Frontend:

- Unit/số thẻ luôn lấy qua `getDeliveryUnitConfig()` (`features/dashboard/utils.ts`): ưu tiên `delivery.unitConfig`, không bao giờ suy ra từ slot của đơn vị khác.
- Tab đơn vị hiển thị `active` + `lentSlotRows` trong **cùng một bảng**, không có mục riêng. Cột "Vị trí" có tag vàng: "Mượn {đơn vị slot}" ở tab đơn vị đi mượn, "{đơn vị xe} đang mượn" ở tab đơn vị cho mượn.
- Dòng `isLentSlotRow`: mọi nút thao tác hiển thị nhưng **disabled**; dòng `detailRestricted` không bung chi tiết (mobile hiện ghi chú "Không có quyền xem chi tiết"). Backend vẫn chặn thao tác nếu người dùng không có quyền trên đơn vị của xe.
- Tab "Tất cả": mỗi xe một lần; dòng của đơn vị chính được ưu tiên, dòng cho mượn chỉ thêm khi đơn vị của xe nằm ngoài phạm vi người xem.
- Xuất CSV bỏ các dòng cho mượn.
- `/docks`, Backoffice `ZonesTab`/`SlotsTab` nhóm slot theo đơn vị sở hữu slot; `ZonesTab`/`SlotsTab` không hiển thị xe trong slot nên không bị ảnh hưởng.

Lifecycle:

- Audit `delivery.manual_call`, `delivery.start_receiving`, `delivery.complete`, `delivery.cancel`, `delivery.auto_cancel_called_no_show` ghi `unitConfigId` = đơn vị của xe; đơn vị slot nằm trong `metadata` (`slotAssignedUnit`, `crossUnitSlot`) khi có.
- Sau khi hoàn tất/hủy, auto-assign chạy cho **đơn vị sở hữu slot vừa được giải phóng** (`triggerAutoAssignForReleasedSlot`), nên slot cho mượn được lấp lại ngay bằng xe chờ của đơn vị cho mượn.
