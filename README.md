# AI Delivery Scheduling & Yard Management System

Hệ thống quản lý đăng ký và điều phối giao hàng tại Mall (Emart / Thiskyhall / Tenant) với 9 dock nhận hàng, AI priority scoring engine, và màn hình chờ realtime.

---

## Yêu cầu

- Node.js 24 (khuyến nghị cài bằng `fnm` trên Windows)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine + Compose)
- Không cần cài PostgreSQL hoặc Redis cục bộ

---

## Hạ tầng Docker và ứng dụng chạy native

Docker chỉ chạy PostgreSQL và Redis. Backend và frontend chạy trực tiếp bằng Node.js trên Windows, không dùng bind mount, Docker Node container hoặc filesystem polling. PostgreSQL và Redis dùng Docker named volumes `delivery_driver_management_postgres_data` và `delivery_driver_management_redis_data`; không dùng `./data/postgres` hay `./data/redis`, vì quyền UID của tiến trình trong container có thể không tương thích với filesystem WSL bind mount.

### Bước 1 – Clone và vào thư mục

Mở terminal tại thư mục gốc của repository (chứa `docker-compose.yml`).

### Bước 2 – Chuẩn bị cấu hình (lần đầu)

PowerShell:

```powershell
Copy-Item .env.example .env
New-Item -ItemType Directory -Path datafile -Force
```

Linux/macOS:

```bash
cp .env.example .env
mkdir -p datafile
```

Chỉ copy nếu chưa có `.env`; giữ cấu hình hiện có nếu đã tạo. `.env` ở root dùng cho Compose và `REDIS_PASSWORD` là bắt buộc. Backend native dùng `backend/.env` với PostgreSQL và Redis qua `localhost`; nếu mật khẩu có ký tự đặc biệt trong URL, cần percent-encode phần mật khẩu trong `DATABASE_URL`, `DIRECT_URL` và `REDIS_URL`.

### Bước 3 – Khởi động

```bash
docker compose up -d postgres redis
```

Chờ PostgreSQL và Redis healthy, sau đó cài dependency và chạy backend/frontend bằng các terminal native ở phần **Phát triển bằng Node.js trên hệ điều hành** bên dưới. Source thay đổi được theo dõi trực tiếp bởi Windows, không bật polling.

Frontend native gọi API tại `http://localhost:4000` theo `frontend/.env`.

### Bước 4 – Khởi tạo database mới

Chỉ chạy một lần sau `db:deploy` khi PostgreSQL hoàn toàn mới. `db:bootstrap` kiểm tra database trước khi ghi; nếu phát hiện dữ liệu vận hành, master data, device, file hoặc audit đã có thì dừng và không xóa gì. Lệnh này không thuộc quy trình deploy phiên bản mới.

```bash
cd backend
npm run db:deploy
npm run db:bootstrap
```

### Bước 5 – Truy cập

| Dịch vụ     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Database    | localhost:5434        |
| Redis       | localhost:6379        |

Port PostgreSQL và Redis có thể đổi qua `POSTGRES_PORT`, `REDIS_PORT` trong `.env` root. Backend native dùng `PORT` trong `backend/.env`; frontend Vite dùng port 5173. HTTPS production được cấu hình riêng trong Dockerfile/nginx frontend.

Navicat vẫn kết nối PostgreSQL tại `127.0.0.1:5434` với database/user trong `.env`; named volume không làm đổi network hay credential. Redis vẫn mở cục bộ ở `127.0.0.1:6379`: dùng Redis Insight hoặc Redis client hỗ trợ Redis, nhập password `REDIS_PASSWORD` từ `.env`, để xem key, value, TTL và các chỉ số persistence. Repository không tự chạy một trang quản trị Redis riêng.

---

## Các trang chính

| Trang                  | URL               | Mô tả                                           |
| ---------------------- | ----------------- | ----------------------------------------------- |
| Trang chủ              | `/`               | Công khai – chọn đăng ký hoặc theo dõi chuyến |
| Đăng ký bằng mã PO/Thi Công | `/register` | Công khai – đăng ký mặc định                   |
| Đăng ký thủ công       | `/register-manual` | Công khai – nhập đăng ký thủ công/bản giấy      |
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
# Xem logs hạ tầng
docker compose logs -f postgres redis

# Dừng hệ thống
docker compose down

# CẢNH BÁO: lệnh này xóa PostgreSQL và Redis named volumes. Chỉ chạy sau khi
# đã backup và thực sự muốn khởi tạo lại toàn bộ hạ tầng dữ liệu.
docker compose down -v

# Truy cập Prisma Studio (quản lý DB)
cd backend
npx prisma studio
```

## Phát triển bằng Node.js trên hệ điều hành

Cách này yêu cầu cài Node.js/npm trên host. Docker chỉ chạy PostgreSQL và Redis:

```bash
docker compose up -d postgres redis
```

Copy `.env.example` riêng của backend/frontend nếu chưa có. Backend native kết nối PostgreSQL ở `localhost:5434`, Redis ở `localhost:6379`; sửa thông tin kết nối cho khớp `.env` root, nhất là `REDIS_PASSWORD`. Sau đó chạy `npm run dev` trong hai terminal của hệ điều hành.

### Backend

```bash
cd backend
cp .env.example .env
# Sửa DATABASE_URL trỏ về PostgreSQL local
# DATAFILE_ROOT mặc định có thể đặt ../datafile để lưu upload ngoài thư mục backend
npm ci
npm run db:deploy
# Chỉ cho database hoàn toàn mới, chạy đúng một lần:
# npm run db:bootstrap
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm ci
npm run dev
```

Frontend native: http://localhost:5173. Vite mặc định proxy về `http://localhost:4000` khi không có `DEV_PROXY_TARGET`.

## Datafile Storage

Backend dùng `DATAFILE_ROOT` để lưu file upload nội bộ. Mặc định nên dùng thư mục `datafile` ở root repo:

```text
datafile/
  tmp/
  uploads/
  templates/
```

Logo/avatar upload được lưu dưới `uploads/<locationCode>/<unitCode?>/<yyyy>/<mm>/<dd>/...`; database lưu metadata ở `uploaded_files`, còn `logoUrl/avatarUrl` trên location/unit vẫn là URL ảnh đang được sử dụng.

# Quy trình phát triển database với Prisma

Bất kỳ khi nào chỉnh sửa DDL schema.prisma thì phải chạy lệnh:
$ npx prisma migrate dev --name <tên tiếng anh ngắn mô tả thay đổi phân cách bảng dấu \_>

Khi deploy UAT hoặc production, chạy một lệnh:
$ npm run db:deploy

Lệnh này chạy tuần tự `prisma migrate deploy` và `prisma generate`. Image backend cũng gọi chính lệnh này trước khi khởi động. `db:bootstrap` là bước tách biệt, chỉ dùng một lần trên database mới.
