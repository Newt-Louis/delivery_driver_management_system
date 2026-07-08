# Phân Quyền Nhiều Unit Cho CHECKIN Và RECEIVING

## Mục Tiêu

Một tài khoản vận hành có thể được phân quyền thao tác trên nhiều `UnitConfig` trong cùng `BusinessLocation`.

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

`User.unit` vẫn được giữ như unit chính/legacy để không phá contract cũ. Quyền thao tác thật của `CHECKIN` và `RECEIVING` nằm trong `user_unit_permissions`.

Migration `20260708090000_add_user_unit_permissions` backfill dữ liệu cũ: user `CHECKIN`/`RECEIVING` có `unit` sẽ được gán permission tới `UnitConfig` tương ứng trong cùng `BusinessLocation`.

`UnitConfig.icon` là field optional để hiển thị unit đẹp hơn trên UI. Migration `20260708103000_add_unit_config_icon` thêm cột nullable `icon` vào `unit_configs`. Giá trị này có thể là emoji hoặc chuỗi class icon, nhưng frontend hiện render như text.

## Backend Helper Và Cache

File chính: `backend/src/services/unitPermission.ts`.

Helper chính:

- `getUserUnitPermissions(userId)`: đọc permission và cache in-memory 60 giây.
- `replaceUserUnitPermissions(userId, unitConfigIds)`: replace toàn bộ permission của user và invalidate cache.
- `enforceDeliveryUnitPermission(req, res, delivery, operation)`: chặn thao tác delivery theo unit.
- `enforceUserUnitPermissionForUnit(req, res, receivingUnit, operation)`: chặn thao tác trực tiếp theo `ReceivingUnit`.

Chỉ role `CHECKIN` và `RECEIVING` bị enforce theo unit permission. `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE` vẫn thao tác theo role và `BusinessLocation` scope hiện có.

## API User

Các response user trả thêm:

```json
{
  "unitPermissions": [
    {
      "id": "unit_config_id",
      "unit": "EMART",
      "displayName": "EMART",
      "icon": "🏬",
      "businessLocationId": "..."
    }
  ]
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

Với role `CHECKIN`/`RECEIVING`, backend bắt buộc có ít nhất một unit permission. Nếu client cũ chỉ gửi `unit`, backend sẽ dùng `unit` để resolve một `UnitConfig` tương ứng nhằm giữ tương thích.

Unit config API:

- `GET /api/units/configs` trả toàn bộ config trong `BusinessLocation`, bao gồm `icon`.
- `PATCH /api/units/:unit/config` nhận `icon?: string | null` để ADMIN_LOC/SUPERADMIN cấu hình icon.
- `GET /api/brand` trả `icon` trong từng unit branding để các màn hình public dùng cùng dữ liệu từ database.

## Delivery Enforcement

Các thao tác sau đã enforce unit permission:

- `PATCH /api/deliveries/check-in-lookup`
- `PATCH /api/deliveries/:id/check-in`
- `PATCH /api/deliveries/:id/call`
- `PATCH /api/deliveries/:id/start-receiving`
- `PATCH /api/deliveries/:id/complete`
- `PATCH /api/deliveries/:id/cancel` với role `RECEIVING`
- `POST /api/deliveries/auto-dispatch/:unit` với role `RECEIVING`

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

- Role `CHECKIN` và `RECEIVING` chỉ được chọn đúng một unit chính.
- Frontend gửi `unitConfigIds` gồm đúng unit đó và giữ `unit` bằng `ReceivingUnit` của unit đầu tiên để tương thích.

Khi chỉnh sửa tài khoản:

- Role `CHECKIN` và `RECEIVING` hỗ trợ chọn thêm/bớt nhiều unit permission.
- Role khác như `ADMIN_OPE` không hiển thị/chặn thao tác multi-unit vì quyền theo `BusinessLocation`.

Các role được áp dụng unit permission:

- `CHECKIN`
- `RECEIVING`

Filter theo đơn vị trong bảng nhân viên dựa trên `unitPermissions`, không chỉ dựa vào `user.unit`. Label/icon ưu tiên `icon`, `displayName`, `shortName`, rồi tới `unit`.

## Lưu Ý Vận Hành

- Khi ADMIN_LOC/SUPERADMIN cập nhật permission, backend replace toàn bộ danh sách và invalidate cache user tương ứng.
- Nếu đổi role khỏi `CHECKIN`/`RECEIVING`, backend xóa danh sách unit permission vì role đó không cần permission unit.
- Nếu sau này cần multi-unit permission cho `ADMIN_OPE`, mở rộng `roleRequiresUnitPermission()` thay vì tự viết điều kiện riêng trong từng route.
