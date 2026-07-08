# Redis Cache Và Debug Development

## Vai Trò Của Redis

Redis trong hệ thống này là cache/session store, không có ràng buộc tự động với PostgreSQL.

Các dữ liệu chính:

- `auth:session:{sessionId}`: phiên đăng nhập.
- `auth:user:{userId}:sessions`: danh sách session đang hoạt động của user.
- `auth:user:{userId}:profile`: user profile an toàn dùng bởi auth middleware.
- `auth:user:{userId}:unit-permissions`: unit permission của `CHECKIN` và `RECEIVING`.
- `app-config:{key}`: cache JSON cho từng dòng `app_configs`.

Nếu database thay đổi, Redis chỉ thay đổi khi code chủ động refresh hoặc invalidate key. Vì vậy mọi route ghi user/app config phải gọi helper cache tương ứng sau khi ghi DB thành công.

## Luồng Đồng Bộ User

- Login tạo Redis session và ghi `auth:user:{userId}:profile`.
- Middleware auth đọc session, rồi đọc user profile từ Redis.
- Nếu user profile cache miss, backend đọc DB, ghi lại Redis và tiếp tục xử lý.
- Cập nhật user qua ADMIN_LOC/SUPERADMIN refresh `auth:user:{userId}:profile`.
- Cập nhật unit permission refresh `auth:user:{userId}:unit-permissions`.
- Deactivate/delete user xóa profile, xóa unit permission cache và revoke session.

## Luồng Đồng Bộ App Config

Các hàm trong `backend/src/services/appConfig.ts` đọc cache `app-config:{key}` trước, fallback DB khi cache miss.

Khi SUPERADMIN cập nhật app config, code nên dùng:

```ts
await upsertAppConfigValue({ key, value, category, description });
```

Hoặc nếu route tự ghi Prisma trực tiếp thì phải gọi:

```ts
await refreshAppConfigCache(key);
```

## Xem Redis Trên Trình Duyệt Khi Dev

Backend có devDependency `redis-commander`.

Chạy Redis container trước:

```bash
docker compose up -d redis
```

Mở Redis UI:

```bash
cd backend
npm run redis:ui
```

Truy cập:

```text
http://localhost:8081
```

Thông tin đăng nhập dev:

```text
username: dev
password: dev
```

Script chạy read-only để tránh vô tình sửa/xóa key trong lúc debug. Không dùng script này cho production.
