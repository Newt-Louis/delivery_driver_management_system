# Báo Cáo Và Phân Tích

## Mục Tiêu

Hệ thống có báo cáo lịch sử, tổng quan hiệu năng và phân tích thời gian nhận hàng để gợi ý cấu hình phù hợp.

## Frontend

Files:

- `frontend/src/pages/Reports.tsx`
- `frontend/src/pages/ReceivingTimes.tsx`

## Backend APIs

Reports:

- `GET /api/reports/overview`
- `GET /api/reports/breakdown`
- `GET /api/reports/daily-trend`
- `GET /api/reports/hourly-heatmap`
- `GET /api/reports/deliveries`
- `GET /api/reports/slot-performance`
- `GET /api/reports/ai-slot-recommendations`

Analytics:

- `GET /api/analytics/receiving-times`
- `POST /api/analytics/receiving-times/analyze`
- `PATCH /api/analytics/receiving-times/:id/accept`
- `PATCH /api/analytics/receiving-times/accept-all`

## Backend Files

- `backend/src/routes/reports.ts`
- `backend/src/routes/analytics.ts`

Models:

- `DeliveryHistory`
- `DeliveryHistoryEvent`
- `Slot`
- `ReceivingTimeConfig`

Từ giai đoạn 3, danh sách lịch sử giao hàng đọc từ `delivery_history`; timeline chi tiết đọc từ `delivery_history_events`.

## Quyền

- Reports được thiết kế cho admin/operation; cần tiếp tục đảm bảo scope theo `businessLocationId`.
- Analytics:
  - View: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Analyze/accept: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.

## Lưu Ý Kỹ Thuật

- Raw SQL phải dùng `Prisma.sql`, không nối chuỗi SQL thủ công.
- Date range trong reports cần thống nhất timezone VN nếu báo cáo theo ngày vận hành.
- `ReceivingTimeConfig` unique theo `[unit, vehicleType, goodsType]`.
