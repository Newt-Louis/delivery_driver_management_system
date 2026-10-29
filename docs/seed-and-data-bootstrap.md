# Bootstrap Database Và Khởi Tạo Dữ Liệu

## Mục Tiêu

`db:bootstrap` chỉ tạo bộ dữ liệu khởi đầu trên PostgreSQL hoàn toàn mới, sau khi schema đã được deploy. Đây không phải lệnh deploy thường kỳ, không phải công cụ reset, và không dùng để tạo location/unit trong lúc vận hành. Sau bootstrap, Superadmin quản lý `BusinessLocation`, `UnitConfig`, vendor, device và các cấu hình runtime từ ứng dụng.

## Script Chính

Backend package scripts:

- `npm run db:deploy`
- `npm run db:bootstrap`
- `npm run db:seed_app_config`

## Files

- `backend/prisma/seed.ts`
- `backend/prisma/appConfigSeed.ts`
- `backend/prisma/app-config-seed.json`

## Bootstrap Master Data

`npm run db:bootstrap` chạy `seed.ts` để khởi tạo master data; không tạo dữ liệu đăng ký, check-in hay receiving giả.

Lệnh tự kiểm tra trước khi ghi. Chỉ hai trạng thái được chấp nhận:

- Database không có `BusinessLocation`; hoặc
- Chỉ có placeholder `singleton` / `DEFAULT` do migration lịch sử tạo ra.

Các bảng vận hành và master data phải trống. Chỉ cần tồn tại user, quyền, device, location khác, unit, zone, slot, delivery, history, sequence, file, audit hoặc cấu hình vận hành là bootstrap dừng với lỗi, không xóa bất cứ dữ liệu nào. `AppConfig` độc lập và được giữ nguyên để có thể chạy `db:seed_app_config` trước hoặc sau bootstrap.

Khi database chỉ có placeholder migration, bootstrap xóa đúng placeholder này rồi tạo dữ liệu bên dưới. Không còn `deleteMany()` và không có chức năng reset dữ liệu.

Seed tạo:

- Hai `BusinessLocation`: `SAL` (THISO SALA) và `PVT` (THISO Phan Văn Trị).
- Mỗi location có ba unit runtime: `THISKYHALL` (hiển thị Thiskyhall), `TENANT` (hiển thị THISO Mall) và `EMART` (hiển thị Emart).
- Mỗi unit có một zone: `KT-1`, `KM-1`, `KE-1`; mỗi zone chứa các slot tương ứng `T1`–`T3`, `M1`–`M3`, `E1`–`E6`.
- `T3` và `M3` là xe máy, capacity 5; `E1`–`E6` là xe tải, capacity 5; các slot còn lại là xe tải, capacity 1. Mọi slot nhận ba loại hàng thường theo thứ tự Fresh food, General goods, Thi công.
- Ba `UnitGoodsType` cho mỗi unit; không tạo `DeliveryTimeWindow` hoặc `ReceivingTimeConfig` để người dùng cấu hình sau.
- Không tạo, xóa hoặc cập nhật Device. Nếu database đã có Device, bootstrap dừng ngay.

Tài khoản tạo sẵn:

- `superadmin@mall.com` / `password123`.
- SAL: `adminloc.sal@mall.com`, `adminope.sal@mall.com`, `receiving.sal@mall.com`, `checkin.sal@mall.com` / `Thiso@123456`.
- PVT: `adminloc.pvt@mall.com`, `adminope.pvt@mall.com`, `receiving.pvt@mall.com`, `checkin.pvt@mall.com` / `Thiso@123456`.

Mỗi tài khoản nghiệp vụ có `UserUnitPermission` trên cả ba unit thuộc location của mình. Mã slot được unique trong zone, không phải toàn hệ thống; do đó SAL và PVT đều có thể có slot `T1`, `M1`, `E1`.

## App Config Seed

`appConfigSeed.ts` tạo/cập nhật cấu hình cố định trong `AppConfig`.

Dùng cho:

- Static IP auth policy.
- Face ID/WebAuthn policy.
- Các cấu hình ứng dụng sau này.

Trang Superadmin có tab App configs để chỉnh các config runtime editable và refresh Redis cache tương ứng. Dòng `isSensitive = true` được mask khi đọc qua UI/API Superadmin.

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
npm run db:deploy
```

Trên server/clone hoàn toàn mới, chạy thêm một lần sau đó:

```bash
npm run db:bootstrap
```

Không chạy `db:bootstrap` trong mỗi lần cập nhật UAT hoặc production.
