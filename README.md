# AI Delivery Scheduling & Yard Management System

Hệ thống quản lý đăng ký và điều phối giao hàng tại Mall (Emart / Thiskyhall / Tenant) với 9 dock nhận hàng, AI priority scoring engine, và màn hình chờ realtime.

---

## Yêu cầu

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Docker Engine + Compose)
- Không cần cài Node.js/npm, PostgreSQL hay Redis cục bộ nếu dùng Docker

---

## Chạy hệ thống bằng Docker

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

Chỉ copy nếu chưa có `.env`; giữ cấu hình hiện có nếu đã tạo. `.env` ở root dùng cho Compose; `REDIS_PASSWORD` bắt buộc. Backend trong Docker dùng hostname `postgres`/`redis`, không dùng `localhost` để gọi hai service này. Nếu mật khẩu có ký tự đặc biệt trong URL, cần percent-encode phần mật khẩu trong `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` của Compose.

### Quyền file khi mount source

Hai container Node chạy bằng user thường, mặc định UID/GID `1000:1000`; `docker exec` cũng dùng user này. Trên Docker Desktop Windows giữ mặc định và bảo đảm tài khoản Windows có quyền đọc/ghi repository và Docker Desktop được truy cập ổ đĩa chứa source.

Trên Linux, chạy `id -u` và `id -g`, rồi đặt `LOCAL_UID`/`LOCAL_GID` tương ứng trong `.env` **trước khi khởi động**. Tạo `datafile` bằng user hiện tại; Compose sẽ báo lỗi nếu thư mục chưa tồn tại thay vì tự tạo thư mục thuộc root. Container cần ghi vào `frontend`, `backend`, các thư mục `node_modules` và `datafile`.

Nếu các thư mục sinh ra từ lần chạy cũ thuộc root, sửa ownership đúng các thư mục đó trên Linux, ví dụ:

```bash
sudo chown -R "$(id -u):$(id -g)" frontend/node_modules backend/node_modules datafile
```

Chỉ áp dụng cho thư mục đã tồn tại và cần sửa quyền. Không dùng `chmod 777` hoặc đổi ownership toàn bộ repository/database. Entrypoint kiểm tra quyền ghi trước khi cài dependencies và báo UID/GID nếu bị từ chối.

### Bước 3 – Khởi động

```bash
docker compose up -d
```

Compose build image dev khi chưa có image, mount `./frontend` và `./backend` vào `/app` của từng container, rồi chạy `npm ci` trong container mỗi lần khởi động. `frontend/node_modules` và `backend/node_modules` được tạo ngay trên checkout; không có volume riêng che hai thư mục này. Backend tự generate Prisma Client, chạy `prisma migrate deploy`, rồi `npm run dev`; frontend tự chạy Vite với `--host 0.0.0.0`. Lần đầu có thể lâu vì tải image và dependencies; theo dõi bằng `docker compose logs -f frontend backend`.

Source thay đổi sẽ được dev server theo dõi, không cần rebuild image. Polling bật mặc định cho Docker Desktop; đặt `DEV_WATCH_POLLING=false` trong `.env` nếu dùng filesystem Linux và muốn giảm CPU. Khi thay đổi dependencies/package-lock, chạy `docker compose restart frontend backend` để cài lại. Chỉ cần `docker compose up -d --build` khi sửa Dockerfile/entrypoint.

Frontend gọi `/api`, `/datafile` và `/socket.io` cùng origin; Vite proxy đến `http://backend:4000`. Các biến `VITE_API_URL`/`VITE_SOCKET_URL` trong container được đặt rỗng để tránh URL localhost từ file `.env` dành cho chạy native.

### Bước 4 – Seed dữ liệu mẫu

Chờ backend báo healthy trong `docker compose ps`. **Chỉ chạy seed nếu muốn tạo lại dữ liệu mẫu: script này xóa dữ liệu hiện có**, nên không tự động chạy khi container khởi động.

```bash
docker compose exec backend npm run seed
```

### Bước 5 – Truy cập

| Dịch vụ     | URL                   |
| ----------- | --------------------- |
| Frontend    | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Database    | localhost:5434        |
| Redis       | localhost:6379        |

Port host có thể đổi qua `FRONTEND_PORT`, `BACKEND_PORT`, `POSTGRES_PORT`, `REDIS_PORT` trong `.env`. Đây là dev server HTTP; HTTPS production được cấu hình riêng trong Dockerfile/nginx frontend.

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

# Dừng và xóa named volumes (database vẫn lưu ở ./data/postgres)
docker compose down -v

# Rebuild sau khi thay đổi Dockerfile/entrypoint
docker compose up -d --build

# Chạy mọi lệnh Node/npm bên trong container; không cần Node.js trên host
docker exec -it mall_frontend sh
docker exec mall_frontend npm run build
docker exec mall_backend npm run db:generate

# Truy cập Prisma Studio (quản lý DB)
docker compose exec backend npx prisma studio
```

`docker exec mall_frontend npm run dev` khởi động thêm một Vite process. Compose đã chạy dev server sẵn, nên bình thường chỉ cần `docker compose up -d`. Nếu muốn tự chạy dev trong terminal, dùng:

```bash
docker compose stop frontend
docker compose run --rm --service-ports frontend npm run dev -- --host 0.0.0.0
```

Lệnh `run` vẫn chạy `npm ci` trong container trước khi chạy Vite. Không chạy hai dev server đồng thời trên cùng port. Dependencies được cài cho Linux trong container; khi chuyển sang chạy Node.js native trên Windows/macOS, chạy lại `npm ci` bằng Node.js của hệ điều hành để thay các binary theo đúng platform (và ngược lại).

---

## Phát triển bằng Node.js trên hệ điều hành

Cách này yêu cầu cài Node.js/npm trên host. Chỉ bật PostgreSQL và Redis bằng Docker; không cần comment service frontend/backend:

```bash
docker compose stop frontend backend
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
npm run db:migrate
# Tùy chọn: npm run seed (xóa dữ liệu cũ và tạo lại dữ liệu mẫu)
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

Khi deploy server thì chạy lệnh:
$ npx prisma migrate deploy
Tiếp theo là: (Khi có sự cố, bình thường thì đã có lệnh npm run postinstall chạy lệnh này khi build rồi)
$ npx prisma generate
