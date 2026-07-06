# Seed Và Khởi Tạo Dữ Liệu

## Mục Tiêu

Hệ thống cần seed dữ liệu demo/dev và seed dữ liệu IT quản lý cho location/unit/app config.

## Script Chính

Backend package scripts:

- `npm run seed`
- `npm run db:seed -- --location:all`
- `npm run db:seed -- --location:business`
- `npm run db:seed -- --location:unit --file=prisma/location-seed.json`
- `npm run db:seed_app_config`

## Files

- `backend/prisma/seed.ts`
- `backend/prisma/locationSeed.ts`
- `backend/prisma/location-seed.json`
- `backend/prisma/appConfigSeed.ts`
- `backend/prisma/app-config-seed.json`

## Demo Seed

`seed.ts` phục vụ demo/dev, có thể xóa/tạo lại dữ liệu mẫu. Không nên xem là công cụ migration dữ liệu production.

Demo accounts trong `REPORT.md`/lịch sử dự án:

- `superadmin@mall.com`
- `admin@mall.com`
- `operator@mall.com`
- `receiving@mall.com`
- `checkin@mall.com`

## Location Seed

`locationSeed.ts` phục vụ IT tạo:

- `BusinessLocation`
- admin location role `ADMIN_LOC`
- `UnitConfig`

Chế độ:

- `--location:all`
  - Tạo business location + admin + units trong file JSON.
- `--location:business`
  - Chỉ tạo business location + admin.
- `--location:unit`
  - Thêm unit vào business location đã tồn tại, bắt buộc có `businessLocationId`.
- `--dry-run`
  - Validate và kiểm tra unique, không ghi DB.

Rule:

- Không cho trùng `BusinessLocation.id`.
- Không cho trùng `BusinessLocation.code`.
- Không cho trùng admin email.
- Không cho trùng pair `businessLocationId + unit`.
- Admin email phải unique toàn hệ thống.

## App Config Seed

`appConfigSeed.ts` tạo/cập nhật cấu hình cố định trong `AppConfig`.

Dùng cho:

- Static IP auth policy.
- Face ID/WebAuthn policy.
- Các cấu hình ứng dụng sau này.

## Lệnh Prisma

Khi sửa schema:

```bash
cd backend
npx prisma migrate dev --name <short_english_name>
npx prisma generate
```

Khi deploy:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```
