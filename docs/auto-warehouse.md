# Luồng Vendor Kho Tự Động

## Mục Tiêu

Kho tự động là luồng riêng cho vendor/PO được cấu hình. Khi vendor code khớp danh sách active, delivery có thể được đánh dấu `autoWarehouse = true` và đi vào status `AUTO_WAREHOUSE_RECEIVING` khi bắt đầu nhận.

## Database

Model:

- `AutoWarehouseVendor`
  - `unit`
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
- `backend/src/services/autoAssign.ts`

API:

- `GET /api/aw-vendors`
- `GET /api/aw-vendors/check`
- `POST /api/aw-vendors`
- `PATCH /api/aw-vendors/:id`
- `DELETE /api/aw-vendors/:id`

Rule:

- `GET /api/aw-vendors/check?unit=...&vendorCode=...` là public check cho register form.
- Slot `autoWarehouseOnly = true` chỉ nhận `AUTO_WAREHOUSE`.
- Slot thường loại `AUTO_WAREHOUSE`.
- Khi start receiving delivery có `autoWarehouse = true`, status chuyển `AUTO_WAREHOUSE_RECEIVING`.

## Frontend

Files:

- `frontend/src/features/register/hooks/useRegisterForm.ts`
- `frontend/src/features/backoffice/tabs/AWVendorTab.tsx`

Register:

- Khi user nhập vendor code và receiving unit, frontend debounce check `/api/aw-vendors/check`.
- Nếu match, hiển thị thông tin vendor kho tự động và submit delivery với flag liên quan.

Backoffice:

- Tab `Kho tự động` quản lý vendor code active/inactive.

## Quyền

- Quản lý vendor: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- Check vendor trong register: public.
