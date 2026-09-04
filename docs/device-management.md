# Quản Lý Thiết Bị

## Mục Tiêu

`Device` là registry thiết bị thuộc một `BusinessLocation`. Hiện tại hệ thống giữ CRUD thiết bị để phục vụ các policy thiết bị hoặc luồng xác thực nâng cao sau này, nhưng không còn route kiosk terminal sử dụng trực tiếp.

## Database

Model:

- `Device`
  - `code`
  - `name`
  - `businessLocationId`
  - `deviceType`: `FIXED_DEVICE`, `PDA`, `TABLET`, `TV`
  - `deviceSecretHash`
  - `isActive`
  - `lastSeenAt`

## Backend

File:

- `backend/src/routes/devices.ts`: controller mỏng cho endpoint thiết bị.
- `backend/src/modules/devices/deviceFormRequest.ts`: validate payload thiết bị bằng Zod.
- `backend/src/modules/devices/deviceRepository.ts`: query thiết bị với `DEVICE_SAFE_SELECT`, không select `deviceSecretHash`.
- `backend/src/modules/devices/deviceService.ts`: rule tạo/sửa/deactivate thiết bị, hash secret bằng bcrypt và audit.

API:

- `GET /api/devices`
- `POST /api/devices`
- `PATCH /api/devices/:id`
- `DELETE /api/devices/:id`

Quyền:

- `SUPERADMIN`: `/api/devices` quản lý trong selected operational context; quản lý thiết bị toàn hệ thống dùng route riêng dưới `/api/superadmin/devices`.
- `ADMIN_LOC`: chỉ được quản lý thiết bị trong `businessLocationId` của chính tài khoản.

Nguyên tắc bảo mật:

- Không bao giờ trả `deviceSecretHash` ra API response.
- Khi tạo/cập nhật secret, backend hash bằng bcrypt.
- Nếu xây dựng lại luồng thiết bị sau này, phải có API riêng theo từng nhiệm vụ và không dùng một endpoint đi xuyên toàn bộ lifecycle.

## Ghi Chú

- Route `/api/checkin` và frontend `/kiosk` đã bị loại bỏ.
- `Device` vẫn được giữ lại vì có thể dùng cho kiểm soát thiết bị cố định, IP nội bộ, PDA, TV hoặc policy đăng nhập theo thiết bị trong giai đoạn sau.
- `staff_pins` đã bị loại bỏ trong giai đoạn 3; thiết bị vẫn được giữ cho các policy thiết bị hoặc xác thực nâng cao sau này.
