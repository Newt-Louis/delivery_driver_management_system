# Xác Thực, Role Và Scope Theo BusinessLocation

## Mục Tiêu

Hệ thống dùng JWT cho nhân sự nội bộ. Tài xế là khách vãng lai, không cần đăng nhập.

Role hiện có trong `backend/prisma/schema.prisma`:

- `SUPERADMIN`: toàn quyền hệ thống, không bắt buộc gắn `BusinessLocation`.
- `ADMIN_LOC`: admin của một `BusinessLocation`, toàn quyền trong khu vực đó.
- `ADMIN_OPE`: điều phối/vận hành trong khu vực.
- `RECEIVING`: nhận hàng, bắt đầu và hoàn tất giao hàng.
- `CHECKIN`: check-in lượt đăng ký của tài xế.

## Backend

File chính:

- `backend/src/routes/auth.ts`
- `backend/src/middleware/auth.ts`
- `backend/src/routes/users.ts`

API:

- `POST /api/auth/login`
  - Validate email/password.
  - Check `User.isActive`.
  - Check static IP policy nếu app config đang bật.
  - Check Face ID/WebAuthn policy nếu app config đang bật.
  - Trả về `{ token, user }`.
- `POST /api/auth/face-id/register/options`
- `POST /api/auth/face-id/register/verify`
- `POST /api/auth/face-id/authenticate/options`
- `POST /api/auth/face-id/authenticate/verify`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/reset-password`
- `DELETE /api/users/:id`
- `GET /api/users/location-staff`
- `POST /api/users/location-staff`
- `PATCH /api/users/location-staff/:id`
- `PATCH /api/users/location-staff/:id/reset-password`
- `DELETE /api/users/location-staff/:id`

Hàm quan trọng:

- `authenticate(req, res, next)` trong `middleware/auth.ts`
  - Đọc Bearer token.
  - Verify JWT.
  - Đọc lại user từ database để chặn token cũ sau khi user bị xóa/vô hiệu hóa.
  - Set `req.user`.
- `requireRole(...roles)` trong `middleware/auth.ts`
  - Chặn endpoint theo role.
- `enforceScope(req, res, next)` trong `middleware/auth.ts`
  - `SUPERADMIN` có thể truyền query `businessLocationId`.
  - Non-superadmin bị ép scope theo `req.user.businessLocationId`.
- `enforceResourceScope(req, res, resourceBusinessLocationId)` trong `middleware/auth.ts`
  - Đảm bảo resource thuộc đúng khu vực của user.
- `userPayload()` và `signLoginToken()` trong `routes/auth.ts`
  - Định dạng payload trả về frontend.

## Frontend

File chính:

- `frontend/src/context/AuthContext.tsx`
- `frontend/src/lib/api.ts`
- `frontend/src/App.tsx`
- `frontend/src/pages/Login.tsx`
- `frontend/src/components/Navbar.tsx`

Luồng:

- `Login.tsx` gọi `POST /api/auth/login`.
- `AuthContext` lưu `token` và `user` vào `localStorage`.
- `api.ts` tự động gắn `Authorization: Bearer <token>`.
- Nếu API trả 401, `api.ts` xóa session và redirect `/login`, trừ một số luồng public/track đặc biệt.
- `App.tsx` dùng `ProtectedRoute` để chặn route theo role.

Route theo role hiện tại:

- `/check-in`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `CHECKIN`.
- `/dashboard`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/docks`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/backoffice`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- `/receiving-times`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
- `/reports`: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.

## Điểm Cần Lưu Ý

- `CHECKIN` hiện không được gọi API start/complete/cancel/call trong `/api/deliveries`.
- Scope hiện tại chính là `businessLocationId`; unit-level permission cho `CHECKIN` chưa được hoàn thiện.
- `User.unit` đã tồn tại nhưng mới là một unit đơn lẻ, chưa có cơ chế multi-unit allowlist.
- API user cấp `SUPERADMIN` và API staff cấp `ADMIN_LOC` là hai lớp quản lý khác nhau.
