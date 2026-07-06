# Cấu Hình Backoffice

## Mục Tiêu

Backoffice là khu cấu hình cho admin/operation theo role. Trang đã được refactor để `frontend/src/pages/Backoffice.tsx` chỉ còn shell route page, các tab nằm trong `frontend/src/features/backoffice`.

## Frontend

Files:

- `frontend/src/pages/Backoffice.tsx`
- `frontend/src/features/backoffice/api.ts`
- `frontend/src/features/backoffice/constants.ts`
- `frontend/src/features/backoffice/types.ts`
- `frontend/src/features/backoffice/tabs/UnitsTab.tsx`
- `frontend/src/features/backoffice/tabs/ZonesTab.tsx`
- `frontend/src/features/backoffice/tabs/SlotsTab.tsx`
- `frontend/src/features/backoffice/tabs/BrandTab.tsx`
- `frontend/src/features/backoffice/tabs/StaffUsersTab.tsx`
- `frontend/src/features/backoffice/tabs/UsersTab.tsx`
- `frontend/src/features/backoffice/tabs/AWVendorTab.tsx`
- `frontend/src/features/backoffice/components/SlotModal.tsx`

Tab và quyền:

- `Người dùng`: chỉ `SUPERADMIN`.
- `Cấu hình Đơn vị`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `Kho tự động`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `Nhân viên`: chủ yếu `ADMIN_LOC` theo location-staff API.
- Zone/slot/brand nhạy cảm: `SUPERADMIN`, `ADMIN_LOC` theo backend guard.
- `ADMIN_OPE` chỉ nên thấy tab operation được phép.

## Backend APIs

Users:

- `/api/users/*`
- `/api/users/location-staff/*`

Units:

- `/api/units/configs`
- `/api/units/:unit/config`
- `/api/units/:unit/goods-types`
- `/api/units/:unit/time-windows`

Zones:

- `/api/zones`

Slots:

- `/api/slots`

Brand:

- `/api/brand`
- `/api/brand/mall`

Auto warehouse vendors:

- `/api/aw-vendors`

Staff PIN:

- `/api/staff-pins`

Devices:

- `/api/devices`

## Lưu Ý Kiến Trúc

- Component chỉ dùng riêng cho Backoffice nên để trong `features/backoffice`.
- Component dùng lại toàn app mới đưa lên `frontend/src/components`.
- API helper riêng của Backoffice nằm trong `features/backoffice/api.ts`.
- Khi thêm tab mới, cần cập nhật cả UI role filter và backend route guard.
