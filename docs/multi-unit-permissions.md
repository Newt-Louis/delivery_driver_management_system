# Phân Quyền Nhiều Unit Cho Role Vận Hành

## Mục Tiêu

Một tài khoản vận hành có thể được phân quyền thao tác trên nhiều `UnitConfig` trong cùng `BusinessLocation`. Áp dụng cho `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`, `CHECKIN`.

Scope chính vẫn là:

```text
BusinessLocation -> UnitConfig -> Zone -> Slot
```

Multi-unit permission không cho phép cross-location. Mọi `UnitConfig` được gán cho user phải thuộc đúng `businessLocationId` của user.

## Dữ Liệu

Schema mới:

- `UserUnitPermission`
  - `userId`
  - `unitConfigId`
  - unique `[userId, unitConfigId]`

`User.unit` vẫn được giữ như unit chính/legacy snapshot để không phá contract cũ. Quyền thao tác thật nằm trong `user_unit_permissions`.

Migration `20260708090000_add_user_unit_permissions` backfill dữ liệu cũ: user `CHECKIN`/`RECEIVING` có `unit` sẽ được gán permission tới `UnitConfig` tương ứng trong cùng `BusinessLocation`.

`UnitConfig.icon` là field optional để hiển thị unit đẹp hơn trên UI. Migration `20260708103000_add_unit_config_icon` thêm cột nullable `icon` vào `unit_configs`. Giá trị này có thể là emoji hoặc chuỗi class icon, nhưng frontend hiện render như text.

## Backend Helper Và Cache

File chính: `backend/src/services/unitPermission.ts`.

Helper chính:

- `getUserUnitPermissions(userId)`: đọc permission từ Redis key `auth:user:{userId}:unit-permissions`, cache miss mới query DB.
- `refreshUserUnitPermissionCache(userId)`: query DB rồi ghi lại Redis.
- `invalidateUserUnitPermissionCache(userId)`: xóa Redis key permission của user.
- `replaceUserUnitPermissions(userId, unitConfigIds)`: replace toàn bộ permission của user trong DB rồi refresh Redis cache.
- `enforceDeliveryUnitPermission(req, res, delivery, operation)`: chặn thao tác delivery theo unit.
- `enforceUserUnitPermissionForUnit(req, res, receivingUnit, operation)`: chặn thao tác trực tiếp theo unit code.

Các role `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`, `CHECKIN` đều bị enforce theo unit permission khi thao tác trên resource có unit. `SUPERADMIN` không bị giới hạn operation scope.

## API User

Các response user trả thêm:

```json
{
  "isActive": true,
  "deletedAt": null,
  "operationUnits": [
    {
      "id": "unit_config_id",
      "code": "EMART",
      "displayName": "EMART",
      "shortName": "EMART",
      "icon": "🏬",
      "businessLocationId": "...",
      "isActive": true
    }
  ],
  "manageableUnits": []
}
```

Các API create/update user nhận thêm:

```json
{
  "unitConfigIds": ["unit_config_id_1", "unit_config_id_2"]
}
```

Áp dụng cho:

- `POST /api/users`
- `PATCH /api/users/:id`
- `POST /api/users/location-staff`
- `PATCH /api/users/location-staff/:id`

Các endpoint list user không trả tài khoản `SUPERADMIN`:

- `GET /api/users`: list system-wide cho Superadmin, nhưng loại `role = SUPERADMIN`.
- `GET /api/users/location-staff`: list theo `BusinessLocation` cho ADMIN_LOC và chỉ gồm `ADMIN_OPE`, `RECEIVING`, `CHECKIN`.

Module backend:

- `backend/src/routes/users.ts`: controller mỏng cho user và location-staff endpoints.
- `backend/src/modules/users/userFormRequest.ts`: validate payload user, location staff và reset password bằng Zod.
- `backend/src/modules/users/userRepository.ts`: query user, location, unit config và history usage.
- `backend/src/modules/users/userService.ts`: rule single SUPERADMIN, location scope, unit assignment, create/update/delete/deactivate, audit, refresh Redis profile/permission cache và revoke session.
- `backend/prisma/migrations/20260803110000_add_user_deleted_at/migration.sql`: thêm `users.deleted_at` để soft-delete user.

Với role `ADMIN_LOC`/`ADMIN_OPE`/`CHECKIN`/`RECEIVING`, backend bắt buộc có ít nhất một unit permission. Nếu client cũ chỉ gửi `unit`, backend sẽ dùng `unit` để resolve một `UnitConfig` tương ứng nhằm giữ tương thích.

User lifecycle:

- `isActive = true`, `deletedAt = null`: tài khoản đăng nhập và thao tác bình thường theo role/unit scope.
- `isActive = false`, `deletedAt = null`: tài khoản bị disable, không được đăng nhập; dữ liệu vẫn hiện trong màn hình quản trị phù hợp.
- `deletedAt != null`: tài khoản đã bị soft-delete. Non-superadmin API quản lý nhân viên không query dòng này; Superadmin vẫn thấy để audit và có thể `Regenerate`.
- `SUPERADMIN` CUD lifecycle `ADMIN_LOC` và `ADMIN_OPE`, đồng thời gán unit scope cho hai role này.
- `ADMIN_LOC` CUD lifecycle `RECEIVING` và `CHECKIN`.
- `ADMIN_LOC` được thấy `ADMIN_OPE` trong API location-staff, nhưng chỉ được PATCH scope-only (`unit`, `unitConfigIds`) cho `ADMIN_OPE`; không reset password, disable, delete hoặc sửa thông tin hồ sơ của `ADMIN_OPE`.
- `DELETE /api/users/:id` và `DELETE /api/users/location-staff/:id` set `deletedAt` và revoke session/cache thay vì hard-delete nếu actor có lifecycle permission trên target role.
- `PATCH /api/users/:id/regenerate` chỉ dành cho `SUPERADMIN` và chỉ áp dụng cho role mà Superadmin quản trị lifecycle, clear `deletedAt` và bật lại `isActive`.

Unit config API:

- `GET /api/units/configs` trả toàn bộ config trong `BusinessLocation`, bao gồm `icon`.
- `PATCH /api/units/:unit/config` nhận `icon?: string | null` để ADMIN_LOC/SUPERADMIN cấu hình icon.
- `GET /api/brand` trả `icon` trong từng unit branding để các màn hình public dùng cùng dữ liệu từ database.

## Delivery Enforcement

Các thao tác sau đã enforce unit permission cho cả `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`, `CHECKIN`:

- `PATCH /api/deliveries/check-in-lookup`
- `PATCH /api/deliveries/:id/check-in`
- `PATCH /api/deliveries/:id/call`
- `PATCH /api/deliveries/:id/start-receiving`
- `PATCH /api/deliveries/:id/complete`
- `PATCH /api/deliveries/:id/cancel`
- `POST /api/deliveries/auto-dispatch/:unit`
- thao tác slot như status/reconcile/assign/create/update/delete khi slot resolve được `unitConfigId`
- thao tác unit config/goods type/time window khi unit resolve được `unitConfigId`

Nếu user không có quyền trên unit của delivery, backend trả `403`:

```json
{
  "error": "Bạn không có quyền thao tác trên đơn vị này.",
  "receivingUnit": "EMART"
}
```

## Frontend Backoffice

Tab nhân viên của `ADMIN_LOC` dùng danh sách unit từ `GET /api/units/configs`, không hardcode unit trên React.

Khi tạo tài khoản mới:

- Superadmin tạo `ADMIN_LOC`/`ADMIN_OPE`; hai role này phải có ít nhất một unit permission.
- ADMIN_LOC tạo `CHECKIN`/`RECEIVING`; hai role này phải có ít nhất một unit permission.
- Frontend gửi `unitConfigIds` và giữ `unit` bằng code của unit đầu tiên để tương thích.

Khi chỉnh sửa tài khoản:

- Superadmin chỉnh lifecycle và unit permission cho `ADMIN_LOC`/`ADMIN_OPE`.
- ADMIN_LOC chỉnh lifecycle và unit permission cho `CHECKIN`/`RECEIVING`.
- ADMIN_LOC được thấy `ADMIN_OPE` và chỉ chỉnh unit permission của `ADMIN_OPE`; các trường hồ sơ, active/delete/reset password của `ADMIN_OPE` không thuộc quyền ADMIN_LOC.
- Nếu chính `ADMIN_LOC` chỉ có operation scope trên một unit, form tạo user cấp dưới hoặc form gán scope vẫn hiển thị toàn bộ unit active của `BusinessLocation` vì đó là delegation scope.

Các role được áp dụng unit permission:

- `ADMIN_LOC`
- `ADMIN_OPE`
- `CHECKIN`
- `RECEIVING`

Filter theo đơn vị trong bảng nhân viên dựa trên `unitPermissions`, không chỉ dựa vào `user.unit`. Label/icon ưu tiên `icon`, `displayName`, `shortName`, rồi tới `unit`.

## Lưu Ý Vận Hành

- Khi ADMIN_LOC/SUPERADMIN cập nhật permission, backend replace toàn bộ danh sách và refresh Redis cache user tương ứng.
- Nếu đổi role khỏi nhóm có operation scope, backend xóa danh sách unit permission vì role đó không cần permission unit.
- Không tự viết điều kiện riêng trong từng route; mở rộng `roleHasUnitOperationScope()` và permission toolkit nếu rule role thay đổi.
