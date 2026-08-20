# AI Delivery Scheduling & Yard Management System

Hệ thống quản lý đăng ký và điều phối giao hàng tại Mall (Emart / Thiskyhall / Tenant) với 9 dock nhận hàng, AI priority scoring engine, và màn hình chờ realtime.

---

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine + Compose)
- Không cần cài Node.js, PostgreSQL cục bộ

---

## Chạy hệ thống bằng Docker

### Bước 1 – Clone và vào thư mục

```bash
cd d:\QUE
```

### Bước 2 – Tạo file .env (tùy chọn)

```bash
cp .env.example .env
```

### Bước 3 – Build và khởi động

```bash
docker compose up -d --build
```

> Lần đầu build mất khoảng 3–5 phút. Backend sẽ tự chạy migration Prisma khi khởi động.

### Bước 4 – Seed dữ liệu mẫu

Chờ backend khởi động xong (~30 giây), sau đó chạy:

```bash
docker compose exec backend npm run seed
```

### Bước 5 – Truy cập

| Dịch vụ     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Database    | localhost:5432        |

---

## Các trang chính

| Trang                  | URL               | Mô tả                                           |
| ---------------------- | ----------------- | ----------------------------------------------- |
| Trang chủ              | `/`               | Công khai – điểm vào mặc định, đăng ký online mới |
| Đăng ký thủ công       | `/register`       | Công khai – nhập đăng ký thủ công/bản giấy      |
| Màn hình chờ           | `/waiting-screen` | Công khai – TV display, realtime                |
| Check-in               | `/check-in`       | Bảo vệ check-in xe vào cổng                     |
| Dashboard              | `/dashboard`      | Nhân viên Receiving điều phối                   |
| Quản lý Dock           | `/docks`          | Xem và cập nhật trạng thái dock                 |

---

## Điều phối tự động

File chính: `backend/src/services/autoAssign.ts`

Luồng hiện tại tự gọi xe từ hàng đợi `WAITING` vào slot phù hợp khi còn sức chứa:

- Slot `autoWarehouseOnly = true` chỉ nhận `AUTO_WAREHOUSE`.
- Slot thường không nhận `AUTO_WAREHOUSE`.
- Thứ tự ưu tiên loại hàng của slot được cấu hình trong Backoffice > Slots > SlotModal (`goodsPriority`); trong cùng một loại hàng, xe tới trước được gọi trước.
- Slot nhiều sức chứa dựa vào `maxCapacity`, đặc biệt cho xe máy.
- Khi assign/complete/cancel, hệ thống cập nhật slot và emit realtime events để dashboard, màn hình chờ và dock management refresh.

---

## Lệnh hữu ích

```bash
# Xem logs
docker compose logs -f backend
docker compose logs -f frontend

# Dừng hệ thống
docker compose down

# Dừng và xóa database
docker compose down -v

# Rebuild sau khi thay đổi code
docker compose up -d --build

# Truy cập Prisma Studio (quản lý DB)
docker compose exec backend npx prisma studio
```

---

## Phát triển local (không dùng Docker)

### Backend

```bash
cd backend
cp .env.example .env
# Sửa DATABASE_URL trỏ về PostgreSQL local
# DATAFILE_ROOT mặc định có thể đặt ../datafile để lưu upload ngoài thư mục backend
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

## Datafile Storage

Backend dùng `DATAFILE_ROOT` để lưu file upload nội bộ. Mặc định nên dùng thư mục `datafile` ở root repo:

```text
datafile/
  tmp/
  uploads/
  templates/
```

Logo/avatar upload được lưu dưới `uploads/<locationCode>/<unitCode?>/<yyyy>/<mm>/<dd>/...`; database lưu metadata ở `uploaded_files`, còn `logoUrl/avatarUrl` trên location/unit vẫn là URL ảnh đang được sử dụng.

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend dev server: http://localhost:5173

# Quy trình phát triển database với Prisma

Bất kỳ khi nào chỉnh sửa DDL schema.prisma thì phải chạy lệnh:
$ npx prisma migrate dev --name <tên tiếng anh ngắn mô tả thay đổi phân cách bảng dấu \_>

Khi deploy server thì chạy lệnh:
$ npx prisma migrate deploy
Tiếp theo là: (Khi có sự cố, bình thường thì đã có lệnh npm run postinstall chạy lệnh này khi build rồi)
$ npx prisma generate
