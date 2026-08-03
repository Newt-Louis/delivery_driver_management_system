# Permission Toolkit

## Mục Tiêu

Permission toolkit là bộ helper thuần TypeScript dùng để gom logic role, hierarchy và unit scope vào một nơi. Code mới không nên tự rải điều kiện kiểu `user.role === 'ADMIN_LOC'` ở từng component/service nếu câu hỏi thật sự là "user này có được quản trị role này không" hoặc "user này có được thao tác trên unit này không".

Backend và frontend đang mirror cùng contract:

- Backend: `backend/src/domain/permissions.ts`
- Backend assertions cho service/route: `backend/src/domain/permissionAssertions.ts`
- Frontend: `frontend/src/lib/permissions.ts`
- Frontend hook bọc ngoài auth context: `usePermission()` trong `frontend/src/context/AuthContext.tsx`

Toolkit không đọc database. Service/repository chịu trách nhiệm resolve user, unit, resource hoặc permission profile từ DB/cache rồi truyền vào helper.

## Auth Profile Contract

Auth response, `/api/auth/me`, Redis profile cache và frontend auth state cùng dùng các field:

```ts
type AuthPermissionUnit = {
  id: string;
  code: string;
  displayName: string;
  shortName?: string;
  icon: string | null;
  businessLocationId: string;
  isActive: boolean;
};

type AuthUserProfile = {
  id: string;
  email: string;
  name: string;
  role: 'SUPERADMIN' | 'ADMIN_LOC' | 'ADMIN_OPE' | 'RECEIVING' | 'CHECKIN';
  businessLocationId: string | null;
  operationUnits: AuthPermissionUnit[];
  manageableUnits: AuthPermissionUnit[];
  capabilities: string[];
};
```

`unitPermissions` vẫn còn trong response như alias tương thích cũ, nhưng code mới nên đọc `operationUnits`.

## Operation Scope Và Delegation Scope

`operationUnits` là danh sách unit mà chính tài khoản đó được thao tác trong màn hình nghiệp vụ của mình.

`manageableUnits` là danh sách unit mà tài khoản được phép gán cho user cấp dưới. Điểm khác biệt quan trọng:

- `ADMIN_LOC` có thể chỉ được thao tác trên một số unit trong `operationUnits`.
- Khi `ADMIN_LOC` tạo `RECEIVING`/`CHECKIN` hoặc chỉnh scope-only cho `ADMIN_OPE`, `manageableUnits` vẫn là toàn bộ unit active trong `BusinessLocation` của ADMIN_LOC.
- Vì vậy ADMIN_LOC có operation scope hẹp vẫn có thể phân quyền cho tài khoản cấp dưới ở unit khác trong cùng location.

`SUPERADMIN` không cần enumerate toàn bộ unit trong auth profile để được coi là có quyền thao tác. Khi vào trang Superadmin, frontend gọi API master data để lấy toàn bộ locations/units.

## Role Hierarchy

Toolkit tách bốn lớp quyền:

- Role capability: role này được vào nhóm màn hình/chức năng nào.
- Unit operation scope: tài khoản cụ thể được thao tác trên `UnitConfig` nào.
- User lifecycle permission: ai được tạo/sửa/xóa/disable tài khoản role nào.
- User scope assignment permission: ai được gán/sửa `unitConfigIds` cho tài khoản role nào.

Rule lifecycle hiện tại:

- `SUPERADMIN`: tài khoản duy nhất, quản trị system-wide master data. User API thường chỉ cho CUD `ADMIN_LOC` và `ADMIN_OPE`; không dùng UI/API thường để tạo thêm `SUPERADMIN`.
- `ADMIN_LOC`: CUD `RECEIVING` và `CHECKIN` trong cùng `BusinessLocation`.
- `ADMIN_OPE`: không quản trị user và không quản trị master data system-wide. Role này tập trung vận hành nghiệp vụ chính như đăng ký nội bộ, check-in, nhận hàng, hủy, hoàn tất, theo dõi/report theo quyền.
- `RECEIVING`: thao tác nhận hàng theo unit được gán.
- `CHECKIN`: thao tác check-in theo unit được gán.

Rule scope assignment hiện tại:

- `SUPERADMIN`: gán/sửa unit scope cho `ADMIN_LOC` và `ADMIN_OPE`.
- `ADMIN_LOC`: gán/sửa unit scope cho `ADMIN_OPE`, `RECEIVING`, `CHECKIN` trong location của mình.
- `ADMIN_LOC` không CUD lifecycle của `ADMIN_OPE`; route location-staff chỉ cho update scope-only với `ADMIN_OPE`.

Helper chính:

- `isSuperadmin(user)`
- `isAdminLoc(user)`
- `isAdminOpe(user)`
- `isReceiving(user)`
- `isCheckin(user)`
- `isLocationAdmin(user)`
- `isOperationalUser(user)`
- `roleHasUnitOperationScope(role)`
- `canManageUserRole(actorRole, targetRole)`
- `canCreateRole(actorRole, targetRole)`
- `canUpdateRole(actorRole, targetRole)`
- `canAssignUserScope(actorRole, targetRole)`

## Unit Operation Helpers

Helper dùng cho backend và frontend:

- `getOperationUnitIds(profile)`
- `canOperateUnit(profile, unitConfigId)`
- `filterOperableUnits(profile, units)`
- `getUnitAccessState(profile, unitConfigId, deniedState)`
- `canAssignUnits(profile, unitConfigIds)`

Frontend có thể dùng `getUnitAccessState()` để quyết định từng màn hình:

- `enabled`: cho thao tác bình thường.
- `readOnly`: hiện dữ liệu nhưng khóa action.
- `disabled`: hiện control nhưng disabled.
- `hidden`: không render phần đó.

Backend không dựa vào trạng thái UI. Mọi action ghi có resource/unit phải gọi assertion tương ứng, ví dụ `assertCanOperateUnit(actor, unitConfigId)`.

## Cache Và Invalidation

Redis keys liên quan:

- `auth:user:{userId}:profile`: profile auth gồm role, location, `operationUnits`, `manageableUnits`, `capabilities`.
- `auth:user:{userId}:unit-permissions`: danh sách unit permission từ `user_unit_permissions`.

Khi update user, unit permission, unit active/display/code hoặc location active, backend phải refresh hoặc invalidate cache user liên quan. Các service mới dùng:

- `refreshAuthUserCache(userId)`
- `invalidateAuthUserCache(userId)`
- `replaceUserUnitPermissions(userId, unitConfigIds)`
- `invalidateUserUnitPermissionCache(userId)`

## Cách Dùng

Backend service:

```ts
const slot = await slotRepository.findSlotWithLocation(id);
assertResourceAccess(user, slot.zone.unitConfig.businessLocationId);
assertCanOperateUnit(user, slot.zone.unitConfigId);
```

Frontend component:

```tsx
const permission = usePermission();
const state = permission.getUnitAccessState(unit.id, 'readOnly');
const disabled = state !== 'enabled';
```

Rule chung: role quyết định màn hình/chức năng lớn; `operationUnits` quyết định phạm vi unit mà hành động đó được thực hiện.
