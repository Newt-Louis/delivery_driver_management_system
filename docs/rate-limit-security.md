# Giới Hạn Request Và Bảo Vệ Public API

## Mục Tiêu

Hệ thống có một số endpoint public hoặc nhạy cảm cần hạn chế request để tránh brute force, spam đăng ký và làm quá tải server.

## Backend

File:

- `backend/src/middleware/rateLimit.ts`

Hàm:

- `rateLimit(options)`
- `authLoginLimiter`
- `publicWriteLimiter`
- `publicLookupLimiter`
- `publicReadLimiter`

## Endpoint Đang Được Gắn Limiter

Auth:

- `POST /api/auth/login`
- `POST /api/auth/face-id/authenticate/options`
- `POST /api/auth/face-id/authenticate/verify`

Public write:

- `POST /api/deliveries/register`
- `POST /api/push/subscribe`

Public lookup/read:

- `GET /api/track/search`
- `GET /api/units/:unit/slots`
- `GET /api/units/:unit/vehicle-availability`

## Response Headers

Limiter có thể trả:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After`

Khi bị chặn:

- HTTP 429.

## Lưu Ý Scale

Limiter hiện là in-memory single-instance. Nếu scale nhiều backend container, cần đổi sang Redis/shared store để đồng bộ hạn mức.

## Bảo Mật Khác

- JWT middleware verify token, kiểm tra Redis session/profile và fallback DB khi cache miss. User bị deactivate/delete sẽ bị chặn sau khi cache/session được refresh hoặc revoke.
- UnitConfig public endpoint strip `vendorApiKey` và `poApiKey`.
- Device API không trả `deviceSecretHash`.
- Audit log không ghi password/secret/token.
- Route staff PIN/action cũ trên track đã bị loại khỏi luồng vận hành; tài xế chỉ dùng các endpoint public read/search/subscribe.
