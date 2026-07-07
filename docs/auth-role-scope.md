# Xác Thực, JWT Session, Role Và Scope

## Mục Tiêu

Hệ thống dùng JWT Bearer cho tài khoản nội bộ. Tài xế là khách vãng lai, không cần đăng nhập.

Backend là API độc lập, không chỉ phục vụ trình duyệt. Web, mobile, tablet, PDA hoặc client tích hợp đều dùng cùng contract: đăng nhập nhận JWT, gửi lại bằng header `Authorization: Bearer <token>`, renew khi cần và logout để hủy session.

## Thành Phần Chính

- `backend/src/routes/auth.ts`: login, me, renew, logout, Face ID/WebAuthn endpoints.
- `backend/src/middleware/auth.ts`: verify Bearer JWT, kiểm tra Redis session, đọc user mới từ DB.
- `backend/src/services/authSession.ts`: tạo session Redis, ký JWT, renew, revoke, phát hiện session đang hoạt động.
- `backend/src/services/redis.ts`: kết nối Redis qua `REDIS_URL`.
- `backend/src/services/appConfig.ts`: đọc cấu hình auth trong `app_configs`.
- `frontend/src/lib/authCookies.ts`: cookie `dqm_token` và device id cho web.
- `frontend/src/lib/api.ts`: gắn Bearer token và renew tự động.
- `frontend/src/context/AuthContext.tsx`: bootstrap user qua `/api/auth/me`, không lưu user vào storage.

## JWT Và Redis Session

JWT vẫn là access token gửi qua header:

```http
Authorization: Bearer <token>
```

JWT payload có `sub` là user id và `sid` là Redis session id. Backend không chỉ tin JWT payload; sau khi verify signature/expiry, middleware đọc session `auth:session:{sid}` trong Redis, rồi đọc lại user từ database để lấy role, unit và `businessLocationId` mới nhất.

Redis keys:

- `auth:session:{sessionId}`: thông tin session, device, IP, user agent, expiry, last seen.
- `auth:user:{userId}:sessions`: danh sách session đang hoạt động của user.

Nếu session Redis bị xóa, hết hạn, bị revoke, hoặc user DB bị deactivate/delete, API protected trả `401`.

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
    "businessLocationId": "..."
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

### `POST /api/auth/renew`

Gửi Bearer token hiện tại. Backend verify signature với `ignoreExpiration`, kiểm tra Redis session còn trong cửa sổ renew, đọc user DB rồi cấp JWT mới.

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

- `SUPERADMIN`: toàn quyền hệ thống, không bắt buộc gắn `BusinessLocation`.
- `ADMIN_LOC`: admin của một `BusinessLocation`.
- `ADMIN_OPE`: vận hành/điều phối trong khu vực.
- `RECEIVING`: nhận hàng, bắt đầu và hoàn tất giao hàng.
- `CHECKIN`: check-in lượt đăng ký của tài xế.

Frontend protected routes:

- `/check-in`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
- `/dashboard`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/docks`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/backoffice`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `/receiving-times`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/reports`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.

## Scope Theo BusinessLocation

- `SUPERADMIN`: có thể truyền query `businessLocationId`; nếu không truyền thì có thể xem toàn hệ thống tùy API.
- Non-`SUPERADMIN`: backend ép scope theo `req.user.businessLocationId`, không tin query `businessLocationId`.
- `enforceResourceScope` dùng để kiểm tra resource thuộc đúng `businessLocationId` của user.

## Socket.IO

Socket không bắt toàn bộ connection phải có JWT vì hệ thống có realtime public:

- `track:join`: public theo registration code.
- Waiting screen/public display: public theo scope hiển thị.
- Dashboard/docks realtime room: yêu cầu token hợp lệ trong payload `realtime:join`.

REST API vẫn là lớp bảo vệ chính cho mọi thao tác thay đổi dữ liệu. Socket auth hiện dùng để giới hạn join room protected, không thay thế `authenticate` trên REST route.
