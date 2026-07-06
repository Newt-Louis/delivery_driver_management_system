# Nhật Ký Audit

## Mục Tiêu

Audit log ghi lại các thao tác quan trọng để truy vết sự cố vận hành, phân quyền và thay đổi cấu hình.

## Database

Model:

- `AuditLog`

Fields quan trọng:

- `actorType`: `USER`, `STAFF`, `DEVICE`, `SYSTEM`.
- `actorId`
- `actorLabel`
- `businessLocationId`
- `unitConfigId`
- `action`
- `targetType`
- `targetId`
- `before`
- `after`
- `metadata`
- `createdAt`

## Backend

File:

- `backend/src/services/auditLog.ts`
- `backend/src/routes/auditLogs.ts`

Hàm:

- `userActor(user)`
- `staffActor(staff)`
- `deviceStaffActor(payload)`
- `systemActor(label)`
- `recordAuditLog(input, client = prisma)`

API:

- `GET /api/audit-logs`
  - Role: `SUPERADMIN`, `ADMIN_LOC`.
  - Filter theo location, unit, action, target, actor, date.
  - Có phân trang cursor.

## Nơi Đã Ghi Audit

- Check-in delivery.
- Manual call.
- Auto assign.
- Start receiving.
- Complete.
- Cancel.
- Device CRUD.
- User/location staff CRUD/reset password/deactivate.
- Zone/slot/unit config/goods type/time window changes.

## Nguyên Tắc Bảo Mật

- Không ghi password plaintext.
- Không ghi token.
- Không ghi device secret.
- Không ghi PIN.
- API key/secret cần được redact nếu đưa vào before/after.

## Lưu Ý

- `recordAuditLog` fail-safe: lỗi ghi audit không làm fail nghiệp vụ chính.
- Một số endpoint cũ cần tiếp tục soát actor cho đúng user thay vì system label.
