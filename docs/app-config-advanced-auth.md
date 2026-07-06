# Cấu Hình Ứng Dụng Và Xác Thực Nâng Cao

## Mục Tiêu

Hệ thống cần một bảng cấu hình chung để bật/tắt policy ứng dụng mà không cần sửa code mỗi lần vận hành. Hiện đã có nền tảng cho:

- Xác thực theo IP tĩnh/nội bộ.
- Face ID/WebAuthn/passkey.
- Các cấu hình tương lai như màu sắc, chủ đề, nút, animation, policy thiết bị.

## Database

Models trong `backend/prisma/schema.prisma`:

- `AppConfig`
  - `key`: khóa cấu hình duy nhất.
  - `category`: nhóm cấu hình.
  - `value`: JSON, cho phép boolean/string/object/array.
  - `valueType`: kiểu mô tả, mặc định `json`.
  - `description`: mô tả.
  - `isSensitive`: đánh dấu cấu hình nhạy cảm.
  - `isRuntimeEditable`: có được chỉnh ở runtime hay không.
- `FaceCredential`
  - Lưu public key WebAuthn của user.
- `AuthChallenge`
  - Lưu challenge đăng ký/đăng nhập Face ID/WebAuthn.

Migration:

- `backend/prisma/migrations/20260706100000_add_app_configs_and_face_auth/migration.sql`

Seed:

- `backend/prisma/app-config-seed.json`
- `backend/prisma/appConfigSeed.ts`
- Script package: `npm run db:seed_app_config`

## Backend

Files:

- `backend/src/services/appConfig.ts`
- `backend/src/services/staticIpAuth.ts`
- `backend/src/services/faceIdAuth.ts`
- `backend/src/routes/auth.ts`

Hàm chính:

- `getStaticIpAuthConfig()`
  - Đọc config static IP từ bảng `app_configs`.
  - Mặc định có thể tắt tính năng bằng `enabled: false`.
- `getFaceIdAuthConfig()`
  - Đọc config Face ID/WebAuthn.
  - Mặc định có thể tắt tính năng bằng `enabled: false`.
- `roleIsConfigured(role, roles)`
  - Kiểm tra role có nằm trong danh sách policy không.
- `getRequestIp(req, trustProxyHeader)`
  - Lấy IP request, có hỗ trợ proxy header nếu config bật.
- `ipIsAllowedByConfig(ip, config)`
  - Check IP hoặc CIDR.
- `createFaceRegistrationOptions()`
- `verifyFaceRegistration()`
- `createFaceAuthenticationOptions()`
- `verifyFaceAuthentication()`

API:

- `POST /api/auth/login`
  - Nếu static IP config bật và role nằm trong policy, IP phải hợp lệ.
  - Nếu Face ID config bật và role nằm trong policy, có thể trả `202 faceIdRequired`.
- `POST /api/auth/face-id/register/options`
- `POST /api/auth/face-id/register/verify`
- `POST /api/auth/face-id/authenticate/options`
- `POST /api/auth/face-id/authenticate/verify`

## Trạng Thái Hiện Tại

- Schema và backend service đã sẵn sàng.
- Config mặc định nên để `enabled: false` cho static IP và Face ID.
- UI superadmin để bật/tắt app configs chưa làm; phần này dự kiến giai đoạn sau.
- Khi bật Face ID/WebAuthn thật, cần test trên HTTPS/domain đúng `rpId` và origin.
