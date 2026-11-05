# Luồng Vendor Kho Tự Động

## Mục Tiêu

Kho tự động là luồng riêng cho vendor/PO được cấu hình. Khi vendor code khớp danh sách active, delivery có thể được đánh dấu `autoWarehouse = true` và đi vào status `AUTO_WAREHOUSE_RECEIVING` khi bắt đầu nhận.

## Database

Model:

- `AutoWarehouseVendor`
  - `unit`
  - `unitConfigId`
  - `vendorCode`
  - `vendorName`
  - `active`
  - `note`

Relation nghiệp vụ:

- `DeliveryRegistration.autoWarehouse` và `goodsType`: phân loại được chốt tại check-in để auto-assign truy vấn hàng chờ, không tra lại danh sách NCC mỗi lần gọi xe.
- `DeliveryRegistration.originalGoodsType`: loại hàng tài xế chọn trước khi phân loại theo NCC, để khôi phục khi NCC không còn active tại thời điểm check-in.
- `DeliveryRegistration.vendorCode`
- `DeliveryRegistration.poNumber`
- `DeliveryRegistration.status = AUTO_WAREHOUSE_RECEIVING`

## Backend

File:

- `backend/src/routes/awVendors.ts`
- `backend/src/routes/deliveries.ts`
- `backend/src/modules/deliveries/deliveryRepository.ts`
- `backend/src/modules/deliveries/deliveryService.ts`
- `backend/src/services/autoAssign.ts`

API:

- `GET /api/aw-vendors`
- `GET /api/aw-vendors/check`
- `GET /api/aw-vendors/suggestions`
- `POST /api/aw-vendors`
- `PATCH /api/aw-vendors/:id`
- `DELETE /api/aw-vendors/:id`
- `GET/POST/PATCH/DELETE /api/superadmin/auto-warehouse-vendors`

Rule:

- `GET /api/aw-vendors/check?code=...&unit=...&businessLocationId=...&unitConfigId=...` là public check cho register form.
- Khi public check có `businessLocationId` hoặc `unitConfigId`, backend resolve `UnitConfig` active trước rồi match vendor bằng `unitConfigId`.
- Contract `code + unit` không có scope chỉ còn là compatibility path cho client/dữ liệu cũ.
- Vendor master data mới được gắn `unitConfigId`; cột `unit` là code snapshot/compat cho public contract theo `unit`.
- Backoffice và Superadmin tạo vendor theo `unitConfigId`, backend tự copy `UnitConfig.unit` vào snapshot `unit`.
- Unique nghiệp vụ mới là `unitConfigId + vendorCode`; cùng một mã NCC có thể tồn tại ở hai `BusinessLocation` khác nhau nếu thuộc hai `UnitConfig` khác nhau.
- Mã NCC là tùy chọn. Lúc đăng ký, backend chuẩn hóa mã rồi kiểm tra NCC active trong đúng unit; chỉ khi khớp mới đổi loại hàng thành `AUTO_WAREHOUSE`. Client không được trực tiếp gửi loại `AUTO_WAREHOUSE` khi đăng ký.
- Trước khi cấp số check-in, backend kiểm tra lại mã NCC trong cùng transaction. Nếu NCC đã được thêm hoặc kích hoạt thì chuyển sang `AUTO_WAREHOUSE`; nếu không còn khớp thì khôi phục loại hàng gốc. Lượt cũ có loại `AUTO_WAREHOUSE` nhưng thiếu loại hàng gốc và NCC không còn khớp phải được kiểm tra hoặc đăng ký lại; không tự đoán loại hàng. Lượt đã `WAITING` không phân loại lại khi check-in lặp hoặc auto-assign.
- `AUTO_WAREHOUSE` là một trong bốn loại hàng cấu hình trong `acceptedGoods` và `goodsPriority` của slot; có thể kết hợp và sắp thứ tự cùng các loại hàng khác.
- Một slot chỉ nhận kho tự động khi danh sách hàng nhận chỉ có `AUTO_WAREHOUSE`; không còn switch hay cột slot dành riêng.
- Slot mới mặc định chỉ nhận ba loại hàng thông thường; vận hành chủ động thêm `AUTO_WAREHOUSE` và sắp ưu tiên cho slot phù hợp. Slot đã có giữ nguyên cấu hình. Auto-assign xét thứ tự ưu tiên của từng slot, không đảm bảo xe kho tự động luôn được đưa đến một slot cụ thể nếu nhiều slot cùng nhận loại này. Gọi thủ công vẫn cho phép người điều phối chọn slot theo nghiệp vụ hiện có.
- Khi start receiving delivery có `autoWarehouse = true`, status chuyển `AUTO_WAREHOUSE_RECEIVING`.

## Frontend

Files:

- `frontend/src/features/register-manual/hooks/useRegisterForm.ts`
- `frontend/src/features/backoffice/tabs/AWVendorTab.tsx`

Register:

- Khi user nhập vendor code sau khi đã chọn `BusinessLocation` và unit, frontend debounce check `/api/aw-vendors/check` với params `{ code, unit, businessLocationId, unitConfigId }`.
- Từ hai ký tự, frontend còn lấy tối đa 10 gợi ý active qua `/api/aw-vendors/suggestions`. Endpoint bắt buộc cả `businessLocationId` và `unitConfigId`, xác nhận unit active thuộc khu vực đó trước khi query; không trả NCC của khu vực/đơn vị khác.
- Nếu match, hiển thị thông tin vendor kho tự động; backend quyết định loại hàng khi nhận đăng ký và trả loại thực tế cho màn hình thành công.

Backoffice:

- Tab `Kho tự động` load unit từ `/api/units/configs`, filter/tạo vendor theo `unitConfigId`, và chỉ làm việc trong scope hiện tại của tài khoản.

Superadmin:

- Tab `AW vendors` quản lý vendor theo location/unit toàn hệ thống.
- Delete trong Superadmin chuyển vendor sang inactive để tránh mất lịch sử cấu hình.

## Quyền

- Quản lý vendor trong Backoffice: `SUPERADMIN`, `ADMIN_LOC`; list/create/update/delete đều đi qua `enforceScope` và unit operation scope.
- Quản lý vendor toàn hệ thống trong Superadmin: chỉ `SUPERADMIN`.
- Check vendor trong register: public.
