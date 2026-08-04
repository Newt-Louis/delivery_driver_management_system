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

- `DeliveryRegistration.autoWarehouse`
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
- Slot `autoWarehouseOnly = true` chỉ nhận `AUTO_WAREHOUSE`.
- Slot thường loại `AUTO_WAREHOUSE`.
- Khi start receiving delivery có `autoWarehouse = true`, status chuyển `AUTO_WAREHOUSE_RECEIVING`.

## Frontend

Files:

- `frontend/src/features/register/hooks/useRegisterForm.ts`
- `frontend/src/features/backoffice/tabs/AWVendorTab.tsx`

Register:

- Khi user nhập vendor code sau khi đã chọn `BusinessLocation` và unit, frontend debounce check `/api/aw-vendors/check` với params `{ code, unit, businessLocationId, unitConfigId }`.
- Nếu match, hiển thị thông tin vendor kho tự động và submit delivery với flag liên quan.

Backoffice:

- Tab `Kho tự động` load unit từ `/api/units/configs`, filter/tạo vendor theo `unitConfigId`, và chỉ làm việc trong scope hiện tại của tài khoản.

Superadmin:

- Tab `AW vendors` quản lý vendor theo location/unit toàn hệ thống.
- Delete trong Superadmin chuyển vendor sang inactive để tránh mất lịch sử cấu hình.

## Quyền

- Quản lý vendor trong Backoffice: `SUPERADMIN`, `ADMIN_LOC`; list/create/update/delete đều đi qua `enforceScope` và unit operation scope.
- Quản lý vendor toàn hệ thống trong Superadmin: chỉ `SUPERADMIN`.
- Check vendor trong register: public.
