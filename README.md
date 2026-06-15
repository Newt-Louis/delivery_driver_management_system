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

| Dịch vụ | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| Database | localhost:5432 |

---

## Tài khoản đăng nhập (sau khi seed)

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | admin@mall.com | password123 |
| Nhân viên Nhận hàng | receiving@mall.com | password123 |
| Bảo vệ | security@mall.com | password123 |

---

## Các trang chính

| Trang | URL | Mô tả |
|---|---|---|
| Đăng ký giao hàng | `/register` | Công khai – NCC/tài xế đăng ký |
| Màn hình chờ | `/waiting-screen` | Công khai – TV display, realtime |
| Check-in | `/check-in` | Bảo vệ check-in xe vào cổng |
| Dashboard | `/dashboard` | Nhân viên Receiving điều phối |
| Quản lý Dock | `/docks` | Xem và cập nhật trạng thái dock |

---

## Cấu trúc thư mục

```
d:\QUE\
├── backend/              # Node.js + Express + TypeScript
│   ├── prisma/           # Schema, migrations, seed
│   └── src/
│       ├── lib/          # Prisma client
│       ├── middleware/   # Auth, error handler
│       ├── routes/       # API routes
│       ├── services/     # priorityEngine.ts
│       └── socket/       # Socket.IO
├── frontend/             # React + Vite + TypeScript
│   └── src/
│       ├── components/   # Shared UI
│       ├── context/      # Auth, Socket context
│       ├── lib/          # API client, types
│       └── pages/        # 6 trang
├── docker-compose.yml
└── README.md
```

---

## AI Priority Scoring Engine

File: `backend/src/services/priorityEngine.ts`

| Điều kiện | Điểm |
|---|---|
| Fresh Food (base) | 100 |
| Auto Warehouse (base) | 80 |
| General Goods (base) | 50 |
| Nhà cung cấp VIP | +20 |
| Đến đúng giờ | +10 |
| Đến trễ | -20 |
| Fresh Food chờ > 30 phút | +30 |

Hàng chờ được sắp xếp: **điểm cao nhất → thời gian check-in sớm nhất**.

---

## Realtime Events (Socket.IO)

| Event | Mô tả |
|---|---|
| `queue_updated` | Danh sách hàng chờ cập nhật |
| `delivery_called` | Xe được gọi vào dock |
| `dock_updated` | Trạng thái dock thay đổi |
| `delivery_completed` | Xe hoàn tất nhận hàng |

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
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend dev server: http://localhost:5173
