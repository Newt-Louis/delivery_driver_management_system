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
- `GET /api/reports/slot-performance`
- `GET /api/reports/ai-slot-recommendations`

Delivery/audit history:

- `GET /api/histories/delivery`
- `GET /api/histories/delivery/:id/events`
- `GET /api/histories/audit`

Analytics:

- `GET /api/analytics/receiving-times`
- `POST /api/analytics/receiving-times/analyze`
- `PATCH /api/analytics/receiving-times/:id/accept`
- `PATCH /api/analytics/receiving-times/accept-all`

## Backend Files

- `backend/src/routes/reports.ts`
- `backend/src/modules/reports/reportFormRequest.ts`
- `backend/src/modules/reports/reportScope.ts`
- `backend/src/modules/reports/reportService.ts`
- `backend/src/modules/reports/reportRepository.ts`
- `backend/src/modules/reports/reportTypes.ts`
- `backend/src/routes/analytics.ts`
- `backend/src/modules/analytics/analyticsFormRequest.ts`
- `backend/src/modules/analytics/analyticsRepository.ts`
- `backend/src/modules/analytics/analyticsService.ts`
- `backend/src/modules/analytics/analyticsTypes.ts`

Models:

- `DeliveryHistory`
- `DeliveryHistoryEvent`
- `Slot`
- `ReceivingTimeConfig`

Từ giai đoạn 3, danh sách lịch sử giao hàng đọc từ `delivery_history`; timeline chi tiết đọc từ `delivery_history_events`. Các API này thuộc route `/api/histories`, không nằm trong `/api/reports`.

## Quyền

- Reports backend gắn middleware ở cấp router: `authenticate`, `enforceScope`, `requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING')`.
- Frontend route `/reports` hiện mở cho `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.
- Non-`SUPERADMIN` bị ép scope theo `businessLocationId`; `SUPERADMIN` có thể xem rộng hơn tùy query/API.
- Analytics:
  - View: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Analyze/accept: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`.

## Lưu Ý Kỹ Thuật

- Raw SQL phải dùng `Prisma.sql`, không nối chuỗi SQL thủ công.
- `routes/reports.ts` chỉ giữ vai trò route/controller mỏng: parse query, resolve scope, gọi service và trả response.
- Report query GET được validate trong `reportFormRequest.ts`; history/audit query GET được validate trong `backend/src/modules/history/historyFormRequest.ts`.
- Query report nằm trong `reportRepository.ts`; tính toán rate, utilization và recommendation nằm trong `reportService.ts`.
- `routes/analytics.ts` là route mỏng; thống kê live average, analyze và accept recommendation nằm trong `backend/src/modules/analytics`.
- Date range trong reports cần thống nhất timezone VN nếu báo cáo theo ngày vận hành.
- `ReceivingTimeConfig` mới có `unitConfigId`; unique mới theo `[unitConfigId, vehicleType, goodsType]` để tránh lẫn cấu hình giữa nhiều `BusinessLocation`.
- Cột `unit` vẫn là code snapshot/compat cho report/API cũ.
- Superadmin có tab `Receiving time configs` và API `/api/superadmin/receiving-time-configs` để CRUD cấu hình theo `UnitConfig`.
