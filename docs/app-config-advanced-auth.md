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
- `backend/src/modules/deliveries/quickRegistrationService.ts`

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
- `GET /api/superadmin/app-configs`
- `PATCH /api/superadmin/app-configs/:key`
- `POST /api/superadmin/api-configs`
- `DELETE /api/superadmin/api-configs/:name`

## API Config Cho Đăng Ký Nhanh

Superadmin có tab API Config để lưu cấu hình request tích hợp bên thứ 3 vào `app_configs`. Các config này phục vụ `POST /api/deliveries/quick-verify`, nơi tài xế nhập mã PO hoặc mã Thi Công tại trang `/`.

Key được backend dùng cố định:

- PO: `api.settings.po_verify`
- Thi Công: `api.settings.thi_cong_verify`

Value JSON hỗ trợ:

```json
{
  "endpoint": "https://example.internal/api/check",
  "method": "POST",
  "payload_keys": ["BUKRS", "EBELN"],
  "payload_defaults": {
    "BUKRS": "VN01"
  },
  "code_key": "EBELN",
  "auth": {
    "type": "basic",
    "header": "Authorization: Basic <base64-user-pass>"
  }
}
```

Quy tắc:

- Không lưu endpoint hoặc credential trong source code; backend chỉ đọc từ `app_configs`.
- `payload_defaults`, `payloadDefaults` hoặc `payload` dùng cho giá trị cố định cần gửi kèm request.
- `code_key` hoặc `codeKey` cho biết field nào nhận mã tài xế nhập. Nếu không khai báo, backend tự suy luận theo `payload_keys`, ví dụ PO ưu tiên `EBELN`.
- `auth.header` được chuyển thành HTTP header khi gọi API ngoài.
- Với PO, có thể cấu hình thêm `site_location_map` hoặc `siteLocationMap` nếu mã site bên thứ 3 thay đổi. Backend có fallback mặc định cho `1001`, `1002`, `1003`, `2001`.
- Response thật của bên thứ 3 được log ở backend để phục vụ tích hợp. Không trả raw response này về frontend.

## Trạng Thái Hiện Tại

- Schema, backend service và tab Superadmin đã sẵn sàng cho config runtime editable.
- Config mặc định nên để `enabled: false` cho static IP và Face ID.
- UI Superadmin mask value nếu `isSensitive = true` và không cho sửa nếu `isRuntimeEditable = false`.
- Khi lưu từ Superadmin, backend invalidate Redis key `app-config:{key}` để request sau đọc giá trị mới.
- Khi bật Face ID/WebAuthn thật, cần test trên HTTPS/domain đúng `rpId` và origin.
