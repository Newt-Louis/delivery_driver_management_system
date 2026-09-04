# Xác Thực, JWT Session, Role Và Scope

## Mục Tiêu

Hệ thống dùng JWT Bearer cho tài khoản nội bộ. Tài xế là khách vãng lai, không cần đăng nhập.

Backend là API độc lập, không chỉ phục vụ trình duyệt. Web, mobile, tablet, PDA hoặc client tích hợp đều dùng cùng contract: đăng nhập nhận JWT, gửi lại bằng header `Authorization: Bearer <token>`, renew khi cần và logout để hủy session.

## Thành Phần Chính

- `backend/src/routes/auth.ts`: controller mỏng cho login, me, renew, logout và Face ID/WebAuthn endpoints.
- `backend/src/modules/auth/authFormRequest.ts`: Zod schema và parser cho body/header của `/api/auth`.
- `backend/src/modules/auth/authService.ts`: điều phối login, static IP policy, Face ID/WebAuthn, session conflict, renew/logout và response auth.
- `backend/src/modules/auth/authRepository.ts`: truy vấn user và Face ID credential count cho auth route.
- `backend/src/middleware/auth.ts`: Express middleware dùng chung cho JWT auth, role, private/public scope và resource scope.
- `backend/src/services/authSession.ts`: tạo session Redis, ký JWT, cache user profile, renew, revoke, phát hiện session đang hoạt động.
- `backend/src/services/redis.ts`: kết nối Redis qua `REDIS_URL`.
- `backend/src/services/appConfig.ts`: đọc cấu hình auth trong `app_configs` qua Redis cache.
- `backend/src/services/unitPermission.ts`: cache unit permission của các role có operation scope trong Redis.
- `backend/src/domain/permissions.ts`: source of truth cho role helpers, hierarchy và unit operation helpers.
- `backend/src/domain/permissionAssertions.ts`: assertions dùng trong service/route sau khi resource đã resolve ra `unitConfigId`.
- `frontend/src/lib/authCookies.ts`: cookie `dqm_token` và device id cho web.
- `frontend/src/lib/api.ts`: gắn Bearer token và renew tự động.
- `frontend/src/context/AuthContext.tsx`: bootstrap user qua `/api/auth/me`, không lưu user vào storage.

## JWT Và Redis Session

JWT vẫn là access token gửi qua header:

```http
Authorization: Bearer <token>
```

JWT payload có `sub` là user id và `sid` là Redis session id. Backend không chỉ tin JWT payload; sau khi verify signature/expiry, `services/authSession.ts` đọc session `auth:session:{sid}` trong Redis, rồi lấy user profile từ Redis key `auth:user:{userId}:profile`. Nếu cache miss, backend mới đọc database và ghi lại Redis. `middleware/auth.ts` gọi `verifyAccessToken()` rồi chuyển kết quả thành `req.user` và `req.authSession`.

Redis keys:

- `auth:session:{sessionId}`: thông tin session, device, IP, user agent, expiry, last seen.
- `auth:user:{userId}:sessions`: danh sách session đang hoạt động của user.
- `auth:user:{userId}:profile`: user profile an toàn cho auth middleware, không chứa password/PIN/secret.
- `auth:user:{userId}:unit-permissions`: danh sách `UnitConfig` mà user vận hành được thao tác.
- `app-config:{key}`: cache JSON của từng dòng `app_configs`.

Session Redis hiện không đặt TTL ở Redis. Nếu key session bị xóa do logout/revoke/Socket.IO cleanup nhưng JWT vẫn còn hợp lệ và user DB còn active, `resolveActiveSessionAndUser()` tự tạo lại session Redis từ JWT payload rồi cho request tiếp tục. API protected chỉ trả `401` khi JWT không hợp lệ/hết hạn, user không còn active, user đã có `users.deleted_at`, hoặc session bị revoke theo cách không thể phục hồi từ JWT hợp lệ.

Redis không tự đồng bộ với PostgreSQL. Mọi thao tác ghi database phải chủ động refresh hoặc xóa key Redis tương ứng. Route quản trị user hiện refresh profile/unit permission sau create/update/reset password, và xóa cache + revoke session khi deactivate/delete. App config nên dùng helper `upsertAppConfigValue()` hoặc gọi `refreshAppConfigCache(key)` sau khi SUPERADMIN lưu thay đổi.

Khi admin thay đổi `businessLocationId`, role, unit hoặc danh sách unit permission của một tài khoản đang hoạt động, backend revoke toàn bộ session và ngắt các protected socket của tài khoản đó. Client nhận `auth_scope_changed`, xóa trạng thái đăng nhập và yêu cầu đăng nhập lại; nhờ vậy socket cũ không tiếp tục nằm trong room của location/unit trước đó.

Session của `SUPERADMIN` có thêm `selectedBusinessLocationId`. Đây là operational context của riêng phiên đăng nhập hiện tại, không ghi vào cột `users.business_location_id`. Khi `SUPERADMIN` chọn khu vực làm việc, backend overlay `req.user.businessLocationId`, `operationUnits`, `manageableUnits` và `unitPermissions` từ `UnitConfig` active của khu vực đó. Vì vậy các route vận hành có thể tiếp tục lấy scope từ auth profile hiện tại, còn `/superadmin` vẫn là bề mặt system-wide riêng.

## Cookie Web

Trình duyệt web lưu JWT trong cookie:

- Tên cookie: `dqm_token`.
- Frontend đọc cookie này để gắn header Bearer.
- Frontend không lưu `token` hoặc `user` vào `localStorage`.
- `AuthContext` chỉ giữ user trong React state và khôi phục bằng `GET /api/auth/me`.

Lưu ý: vì yêu cầu web vẫn tự gắn `Authorization: Bearer`, cookie `dqm_token` phải đọc được bằng JavaScript, nên không phải `HttpOnly`. Nếu sau này muốn `HttpOnly`, backend cần hỗ trợ đọc token trực tiếp từ cookie hoặc đổi contract web riêng.

## API Contract

### `POST /api/auth/login`

Body:

```json
{
  "email": "receiving@mall.com",
  "password": "password123",
  "deviceId": "optional-stable-client-device-id",
  "deviceName": "optional display name",
  "force": false
}
```

Success:

```json
{
  "token": "<jwt>",
  "user": {
    "id": "...",
    "name": "...",
    "email": "...",
    "role": "RECEIVING",
    "unit": "EMART",
    "businessLocationId": "...",
    "operationUnits": [
      {
        "id": "unit_config_id",
        "code": "EMART",
        "displayName": "Emart",
        "shortName": "Emart",
        "icon": "🏬",
        "businessLocationId": "...",
        "isActive": true
      }
    ],
    "manageableUnits": [],
    "capabilities": []
  },
  "expiresAt": "2026-07-07T12:00:00.000Z",
  "expiresInSeconds": 28800,
  "session": {
    "id": "...",
    "deviceId": "...",
    "deviceName": "...",
    "ip": "...",
    "userAgent": "...",
    "lastSeenAt": "...",
    "expiresAt": "...",
    "expiresInSeconds": 32400
  }
}
```

Nếu user đang có session ở thiết bị khác và `auth.session.singleSessionPerUser = true`, backend trả:

```json
{
  "error": "ActiveSessionExists",
  "message": "Tài khoản này đang đăng nhập ở thiết bị khác.",
  "activeSessions": []
}
```

Client có hai lựa chọn:

- Hủy đăng nhập, giữ session cũ.
- Gọi lại login với `force: true` để revoke session cũ và tạo session mới.

### `GET /api/auth/me`

Protected. Trả user hiện tại và session hiện tại. Dùng để web khôi phục auth state sau reload.

Với `SUPERADMIN`, nếu phiên hiện tại đã chọn operational context, `user.businessLocationId` là selected location trong Redis session và `session.selectedBusinessLocationId` cũng được trả về để client có thể hiển thị/debug.

### `GET /api/auth/operational-context/locations`

Protected, chỉ `SUPERADMIN`. Trả danh sách `BusinessLocation` active để modal chọn khu vực vận hành hiển thị. Response có kèm `unitConfigs` active rút gọn để UI biết location đang có bao nhiêu unit.

### `POST /api/auth/operational-context`

Protected, chỉ `SUPERADMIN`.

Body:

```json
{
  "businessLocationId": "business_location_id"
}
```

Backend validate location active, ghi `selectedBusinessLocationId` vào Redis session hiện tại, rồi trả payload giống `/api/auth/me`. Frontend sau đó refresh user state và invalidate query vận hành đang phụ thuộc scope.

### `POST /api/auth/renew`

Gửi Bearer token hiện tại. Backend verify signature với `ignoreExpiration`, kiểm tra Redis session còn trong cửa sổ renew, lấy user profile từ Redis/DB fallback rồi cấp JWT mới.

Client nên gọi renew khi token gần hết hạn hoặc thử renew một lần khi request protected trả `401` do token hết hạn.

### `POST /api/auth/logout`

Protected. Revoke session hiện tại trong Redis. Web client xóa cookie `dqm_token`; mobile/PDA/native client xóa token khỏi secure storage riêng.

## Cấu Hình `app_configs`

Key `auth.session`:

```json
{
  "tokenTtlMinutes": 480,
  "renewGraceMinutes": 60,
  "singleSessionPerUser": true
}
```

- `tokenTtlMinutes`: thời gian sống của JWT access token.
- `renewGraceMinutes`: khoảng session Redis còn cho phép renew sau khi token hết hạn.
- `singleSessionPerUser`: bật cảnh báo khi user đăng nhập ở thiết bị khác và yêu cầu `force` nếu muốn đá phiên cũ.

Static IP và Face ID/WebAuthn vẫn tồn tại trong backend nhưng không phải workflow chính ở giai đoạn này.

Các config auth được cache trong Redis theo key `app-config:{key}` và hiện không đặt TTL. Khi SUPERADMIN cập nhật một dòng `app_configs`, backend phải dùng `upsertAppConfigValue()` hoặc refresh đúng key đó để request sau đọc config mới ngay.

## Auth Permission Profile

Auth profile hiện có ba lớp dữ liệu quyền:

- `role`: role quyết định nhóm màn hình và nhóm chức năng lớn.
- `operationUnits`: các `UnitConfig` mà user được thao tác trong công việc của chính user đó.
- `manageableUnits`: các `UnitConfig` mà user được phép gán cho user cấp dưới khi quản trị tài khoản.

`unitPermissions` vẫn được trả như alias để tương thích code cũ, nhưng code mới nên dùng `operationUnits`.

`ADMIN_LOC` có một case đặc biệt: `operationUnits` là các unit mà ADMIN_LOC tự thao tác cấu hình/vận hành được; `manageableUnits` là toàn bộ unit active trong `BusinessLocation` để ADMIN_LOC có thể phân quyền cho `ADMIN_OPE`, `RECEIVING`, `CHECKIN` ở bất kỳ unit nào trong location đó.

`SUPERADMIN` trong `/superadmin` không cần operational context. Ngoài `/superadmin`, frontend bắt `SUPERADMIN` chọn `BusinessLocation`; sau khi chọn, auth profile của phiên hiện tại có toàn bộ unit active của location đó trong `operationUnits` và `manageableUnits`.

## Unit Permission Cache

Quyền nhiều unit của `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING` và `CHECKIN` nằm trong bảng `user_unit_permissions`, nhưng thao tác vận hành đọc qua Redis:

1. Route delivery gọi helper trong `unitPermission.ts`.
2. Helper đọc `auth:user:{userId}:unit-permissions`.
3. Nếu cache miss, helper query `user_unit_permissions -> unit_configs`, ghi Redis rồi kiểm tra quyền.
4. Khi ADMIN_LOC/SUPERADMIN cập nhật user hoặc unit permission, route user gọi `replaceUserUnitPermissions()` để replace DB và refresh Redis ngay.

Các thao tác đã đi qua helper này gồm check-in lookup, check-in by id, manual call, auto-dispatch, start receiving, complete và cancel.

## Frontend Workflow

1. Login gọi `/api/auth/login` với `deviceId`.
2. Nếu success, web lưu JWT vào cookie `dqm_token`.
3. `AuthContext` giữ user trong memory state.
4. Axios interceptor đọc `dqm_token`, gắn Bearer header.
5. Nếu request protected nhận `401`, interceptor thử `/api/auth/renew` một lần rồi retry request cũ.
6. Nếu renew fail, web xóa `dqm_token` và chuyển về `/login`.
7. Logout gọi `/api/auth/logout`, xóa cookie và state.

## Role Và Route

Role hiện có:

- `SUPERADMIN`: tài khoản duy nhất, toàn quyền hệ thống, không bắt buộc gắn `BusinessLocation`, có route master data riêng `/superadmin`; CUD `ADMIN_LOC`/`ADMIN_OPE` và gán unit scope cho hai role này.
- `ADMIN_LOC`: admin của một `BusinessLocation`, CUD `RECEIVING`/`CHECKIN`, được thấy `ADMIN_OPE` và chỉ được chỉnh unit scope của `ADMIN_OPE`.
- `ADMIN_OPE`: vận hành/điều phối trong khu vực theo unit được gán; không quản trị user và không sở hữu master data system-wide.
- `RECEIVING`: nhận hàng, bắt đầu và hoàn tất giao hàng theo unit được gán.
- `CHECKIN`: check-in lượt đăng ký của tài xế theo unit được gán.

Frontend protected routes:

- `/check-in`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
- `/dashboard`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/docks`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/backoffice`: `SUPERADMIN`, `ADMIN_LOC`.
- `/superadmin`: chỉ `SUPERADMIN`.
- `/receiving-times`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/reports`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `/histories`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.

## Scope Theo BusinessLocation

- `SUPERADMIN`: ngoài bề mặt system-wide riêng `/superadmin`, scope luôn lấy từ selected operational context trong Redis session. Query `businessLocationId` không được phép ghi đè context; nếu khác context hiện tại hoặc chưa chọn context, `enforceScope` trả `403`.
- Non-`SUPERADMIN`: backend ép scope theo `req.user.businessLocationId`; query khác location hiện tại bị từ chối.
- `enforceResourceScope` dùng cho route vận hành và luôn yêu cầu resource thuộc đúng `businessLocationId` hiện tại, kể cả với `SUPERADMIN`. Các route system-wide dưới `/superadmin` tự áp dụng authorization riêng và không dùng helper operational này.

## Scope Theo UnitConfig

Mọi role vận hành dưới `SUPERADMIN` đều có operation scope:

- `ADMIN_LOC`
- `ADMIN_OPE`
- `RECEIVING`
- `CHECKIN`

Khi route/service đã resolve resource ra `unitConfigId`, backend gọi `assertCanOperateUnit(user, unitConfigId)` hoặc helper tương đương. Với action delivery cũ chỉ có `receivingUnit`, service phải resolve scope qua slot/unit config trước khi quyết định.

Không dùng shortcut `ADMIN_LOC` hoặc `ADMIN_OPE` là toàn quyền trên mọi unit nữa. Hai role này vẫn có quyền theo màn hình khác nhau, nhưng phạm vi dữ liệu và thao tác trong màn hình đó bị giới hạn bởi `operationUnits`.

Các API list phục vụ màn hình vận hành nên lọc dữ liệu theo unit scope ở backend. Frontend không được coi disabled/read-only là lớp bảo mật chính; UI chỉ render dữ liệu mà backend đã trả về trong scope hợp lệ.

## Socket.IO

Socket không bắt toàn bộ connection phải có JWT vì hệ thống có realtime public:

- `track:join`: public theo registration code.
- Waiting screen/public display: public theo scope hiển thị.
- Dashboard/docks realtime room: yêu cầu token hợp lệ trong payload `realtime:join`; backend tự suy ra location và unit rooms từ auth session/permission thay vì tin scope do client gửi.

REST API vẫn là lớp bảo vệ chính cho mọi thao tác thay đổi dữ liệu. Socket auth hiện dùng để giới hạn join room protected, không thay thế `authenticate` trên REST route.
