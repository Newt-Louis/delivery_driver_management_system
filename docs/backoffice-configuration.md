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

- `Người dùng`: chỉ `SUPERADMIN` trong `/superadmin`; quản trị staff cấp dưới của `ADMIN_LOC` nằm ở tab nhân viên.
- `Cấu hình Đơn vị`: `SUPERADMIN`, `ADMIN_LOC`; thao tác config theo unit scope.
- `Kho tự động`: `SUPERADMIN`, `ADMIN_LOC`; vendor phải gắn với `unitConfigId`/location-aware.
- `Nhân viên`: `ADMIN_LOC` quản trị `RECEIVING` và `CHECKIN`, đồng thời được thấy/sửa unit scope của `ADMIN_OPE` trong location.
- Zone/slot/goods types/time windows/receiving time config/unit brand: `SUPERADMIN`, `ADMIN_LOC` theo backend guard và unit operation scope.
- `ADMIN_OPE` không truy cập Backoffice để chỉnh cấu hình. Role này thuộc nhóm vận hành dashboard/docks/reports trong phạm vi unit được cấp.
- Link `Superadmin` trong Navbar và CTA trong Backoffice chỉ visible với `SUPERADMIN`.

Các tab cấu hình theo đơn vị không tự dựng danh sách unit ở frontend. Danh sách unit hợp lệ luôn lấy từ `GET /api/units/configs`, đã được backend lọc theo `BusinessLocation` hiện tại và `UserUnitPermission` của tài khoản đăng nhập. Các tab đang theo quy ước này:

- `BrandTab`: render card thương hiệu cho từng `UnitConfig`; lưu bằng `PATCH /api/units/:unit/config` để giữ contract cũ nhưng dữ liệu resolve trong scope hiện tại.
- `UnitsTab`: render cấu hình hàng hóa, khung giờ, slot duration/capacity và API tích hợp theo từng `UnitConfig`.
- `ZonesTab`: tạo/sửa zone bằng `unitConfigId`; nhãn đơn vị lấy từ `UnitConfig.displayName/shortName/unit`.
- `SlotsTab`: filter hiển thị slot bằng `slot.zone.unitConfig.id`, không bằng text `assignedUnit`.
- `AWVendorTab`: filter/tạo vendor bằng `unitConfigId`; backend tự lưu snapshot `unit` để tương thích public register.

Các constant unit legacy như `EMART`, `THISKYHALL`, `TENANT` chỉ còn vai trò fallback hoặc tương thích dữ liệu cũ, không phải source of truth cho UI cấu hình mới.

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

`/api/aw-vendors` hiện đi qua `authenticate + enforceScope` và chỉ cho `SUPERADMIN`/`ADMIN_LOC` quản trị. List/create/update/delete đều resolve `UnitConfig` trong scope hiện tại rồi kiểm tra unit operation permission. Public check `/api/aw-vendors/check` vẫn mở cho register, nhưng khi client truyền `businessLocationId` hoặc `unitConfigId` thì vendor được match bằng `unitConfigId` để tránh lẫn dữ liệu giữa nhiều location có cùng mã unit.

Schema `AutoWarehouseVendor` giữ cột `unit` như snapshot tương thích, nhưng unique nghiệp vụ mới là `unitConfigId + vendorCode`. Vì vậy cùng một mã NCC có thể tồn tại ở hai `BusinessLocation` khác nhau nếu chúng thuộc hai `UnitConfig` khác nhau.

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
- Zones và Slots: dữ liệu vận hành cụ thể thuộc Backoffice/ADMIN_LOC. `/superadmin` có thể đọc/audit system-wide khi cần, nhưng không phải bề mặt chính để ADMIN_LOC cấu hình zone/slot hằng ngày.
- Users: đọc user system-wide qua `/api/users` nhưng backend loại tài khoản `SUPERADMIN` khỏi danh sách; Superadmin tạo/sửa `ADMIN_LOC` và `ADMIN_OPE` bằng modal riêng trong `UsersTab`, tiếp tục dùng user API để giữ rule hierarchy/cache/audit tập trung.
- Goods types và Time windows: dữ liệu vận hành theo `UnitConfig`; bề mặt cấu hình chính thuộc ADMIN_LOC trong Backoffice.
- AW vendors: CRUD vendor kho tự động theo `unitConfigId`.
- Devices: CRUD device registry theo `BusinessLocation`, không trả `deviceSecretHash`.
- App configs: chỉnh JSON runtime config khi `isRuntimeEditable = true`; sensitive value bị mask.
- Receiving time configs: dữ liệu cấu hình theo `unitConfigId + vehicleType + goodsType`; bề mặt cấu hình chính thuộc ADMIN_LOC, còn Superadmin dùng để quan sát/can thiệp system-wide khi cần.

Trong tab Users:

- Nút `Tạo tài khoản` mở modal tạo mới với thông tin tên, email, mật khẩu, role, location, department và unit operation scope.
- Hàng công cụ phía trên bảng có filter độc lập theo location, unit, role, status và ô tìm kiếm tên/email. Các filter chạy client-side trên dữ liệu đã load của tab Users, không gọi lại API theo từng lần chọn hoặc gõ.
- Role filter lấy các role có trong response `/api/users`; status filter được suy ra từ `isActive` và `deletedAt`.
- Bảng có multi-sort theo từng cột; mỗi cột có lựa chọn `Cao đến thấp`, `Thấp đến cao`, `Bỏ chọn`. Nhiều cột được sort theo thứ tự người dùng chọn.
- Bảng phân trang client-side, cho chọn 20, 50 hoặc 100 dòng mỗi trang ở cuối danh sách.
- Nút `Edit` mở lại cùng modal ở chế độ chỉnh sửa cho `ADMIN_LOC`/`ADMIN_OPE`; mật khẩu không nằm trong modal edit, đổi mật khẩu đi qua API reset password riêng.
- Cột `Status` hiển thị `Active`, `Disabled` hoặc `Deleted`.
- Các cột thời gian `Tạo mới`, `Cập nhật`, `Xóa` map lần lượt từ `createdAt`, `updatedAt`, `deletedAt`; giá trị null hiển thị `-`.
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
