# Cấu Hình Backoffice

## Mục Tiêu

Backoffice là khu cấu hình cho admin/operation theo role. Trang đã được refactor để `frontend/src/pages/Backoffice.tsx` chỉ còn shell route page, các tab nằm trong `frontend/src/features/backoffice`.

Từ phase dynamic unit/Superadmin, Backoffice và Superadmin là hai bề mặt khác nhau:

- Backoffice: cấu hình/vận hành theo `BusinessLocation` và theo quyền của tài khoản đang đăng nhập.
- Superadmin: master data toàn hệ thống ở `/superadmin`, chỉ tài khoản `SUPERADMIN` thấy và truy cập được.

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
- `frontend/src/pages/Superadmin.tsx`
- `frontend/src/features/superadmin/api.ts`
- `frontend/src/features/superadmin/types.ts`
- `frontend/src/features/superadmin/tabs/*.tsx`

Tab và quyền:

- `Người dùng`: chỉ `SUPERADMIN`.
- `Cấu hình Đơn vị`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `Kho tự động`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `Nhân viên`: chủ yếu `ADMIN_LOC` theo location-staff API.
- Zone/slot/brand nhạy cảm: `SUPERADMIN`, `ADMIN_LOC` theo backend guard.
- `ADMIN_OPE` chỉ nên thấy tab operation được phép.
- Link `Superadmin` trong Navbar và CTA trong Backoffice chỉ visible với `SUPERADMIN`.

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

Devices:

- `/api/devices`

Superadmin:

- `/api/superadmin/overview`
- `/api/superadmin/business-locations`
- `/api/superadmin/unit-configs`
- `/api/superadmin/zones`
- `/api/superadmin/slots`
- `/api/superadmin/goods-types`
- `/api/superadmin/time-windows`
- `/api/superadmin/auto-warehouse-vendors`
- `/api/superadmin/devices`
- `/api/superadmin/app-configs`
- `/api/superadmin/receiving-time-configs`

Backend refactor hiện tại:

- `/api/units/*` dùng `backend/src/modules/units/*`.
- `/api/users/*` dùng `backend/src/modules/users/*`.
- `/api/zones` dùng `backend/src/modules/zones/*`.
- `/api/slots` dùng `backend/src/modules/slots/*`.
- `/api/devices` dùng `backend/src/modules/devices/*`.
- Các route tương ứng giữ vai trò controller mỏng: guard, parse request và trả response.

## Lưu Ý Kiến Trúc

- Component chỉ dùng riêng cho Backoffice nên để trong `features/backoffice`.
- Component dùng lại toàn app mới đưa lên `frontend/src/components`.
- API helper riêng của Backoffice nằm trong `features/backoffice/api.ts`.
- Khi thêm tab mới, cần cập nhật cả UI role filter và backend route guard.
- Staff PIN và route `/api/staff-pins` đã bị loại khỏi luồng vận hành trong giai đoạn 3.

## Trang Superadmin

Trang `Superadmin` là master-data console, không phải dashboard vận hành. Các tab đang có:

- Locations: tạo/sửa/deactivate `BusinessLocation`.
- Unit configs: tạo/sửa/deactivate unit động trong từng location; response không trả `vendorApiKey`/`poApiKey`.
- Zones và Slots: đọc theo filter location/unit; CRUD vận hành vẫn đi qua route zone/slot hiện có.
- Users: đọc user system-wide qua `/api/users` nhưng backend loại tài khoản `SUPERADMIN` khỏi danh sách; Superadmin tạo/sửa `ADMIN_LOC` và `ADMIN_OPE` bằng modal riêng trong `UsersTab`, tiếp tục dùng user API để giữ rule hierarchy/cache/audit tập trung.
- Goods types và Time windows: đọc dữ liệu theo `UnitConfig`.
- AW vendors: CRUD vendor kho tự động theo `unitConfigId`.
- Devices: CRUD device registry theo `BusinessLocation`, không trả `deviceSecretHash`.
- App configs: chỉnh JSON runtime config khi `isRuntimeEditable = true`; sensitive value bị mask.
- Receiving time configs: CRUD cấu hình thời gian nhận hàng theo `unitConfigId + vehicleType + goodsType`.

Trong tab Users:

- Nút `Tạo tài khoản` mở modal tạo mới với thông tin tên, email, mật khẩu, role, location, department và unit operation scope.
- Nút `Edit` mở lại cùng modal ở chế độ chỉnh sửa cho `ADMIN_LOC`/`ADMIN_OPE`; mật khẩu không nằm trong modal edit, đổi mật khẩu đi qua API reset password riêng.
- Cột `Status` hiển thị `Active`, `Disabled` hoặc `Deleted`.
- Nút `Active`/`Disable` chỉ đổi `isActive`; khi disable thì backend revoke session/cache của user đó.
- Nút `Delete` là soft delete: backend set `users.deleted_at` và `is_active = false`, không hard-delete user.
- Với dòng đã soft-delete, Superadmin vẫn nhìn thấy và nút `Delete` đổi thành `Regenerate`; thao tác này clear `deleted_at` và bật lại `isActive`.
- Các role `RECEIVING` và `CHECKIN` vẫn có thể xuất hiện trong danh sách system-wide để đọc/audit, nhưng Superadmin UI/API không CUD lifecycle các role này.

Các thao tác delete với dữ liệu đã có liên kết lịch sử được service backend chuyển thành deactivate hoặc soft delete thay vì hard-delete. Riêng `User` hiện luôn soft-delete bằng `deleted_at` để giữ audit/history và cho phép regenerate.

## Data Loading Của Superadmin

`frontend/src/pages/Superadmin.tsx` không prefetch toàn bộ master data khi vào trang. Mỗi nhóm API chỉ được bật khi tab tương ứng đang active:

- Tab `Locations`: chỉ load `/api/superadmin/business-locations`.
- Tab `Unit configs`: load locations để chọn `BusinessLocation` và load `/api/superadmin/unit-configs`.
- Tab `Users`: load users, locations và toàn bộ unit configs để modal create/edit gán operation scope.
- Các tab có filter location/unit như zones, slots, goods types, time windows, AW vendors và receiving time configs chỉ load query dữ liệu của chính tab đó cộng với dữ liệu phụ trợ cho filter đang hiển thị.
- Tab `Devices` chỉ cần location filter nên không load unit configs.
- Tab `App configs` chỉ load `/api/superadmin/app-configs`.

Các callback refresh trong tab không invalidate cả namespace `['superadmin']`; chúng chỉ invalidate query key của tab hiện tại để tránh mỗi thao tác CRUD kéo lại toàn bộ API của các tab khác.
