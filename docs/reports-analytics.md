# Báo Cáo Và Phân Tích

## Mục Tiêu

Hệ thống có báo cáo lịch sử, tổng quan hiệu năng và phân tích thời gian nhận hàng để gợi ý cấu hình phù hợp.

## Frontend

Files:

- `frontend/src/pages/Reports.tsx`: route wrapper.
- `frontend/src/features/reports/Reports.tsx`: implementation.
- `frontend/src/pages/ReceivingTimes.tsx`: page layout gốc, compose header/actions, summary, info và bảng theo unit.
- `frontend/src/features/receiving-times/api.ts`: API helper cho analytics receiving-times.
- `frontend/src/features/receiving-times/hooks/useReceivingTimes.ts`: query, quyền apply, analyze/accept action, flash message và export.
- `frontend/src/features/receiving-times/components/*`: header, summary, info, loading, footer và group table.
- `frontend/src/features/receiving-times/utils.ts`: group config theo unit metadata và build CSV rows.

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
- Các route reports/analytics vận hành luôn dùng `businessLocationId` hiện tại từ auth profile. `SUPERADMIN` muốn đổi dữ liệu phải đổi selected operational context; chỉ `/superadmin` là bề mặt system-wide riêng.
- Analytics:
  - View: `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`.
  - Analyze/accept: `SUPERADMIN`, `ADMIN_LOC`.
  - `ADMIN_OPE` chỉ xem để phục vụ vận hành, không chỉnh cấu hình thời gian nhận hàng.

## Lưu Ý Kỹ Thuật

- Raw SQL phải dùng `Prisma.sql`, không nối chuỗi SQL thủ công.
- `routes/reports.ts` chỉ giữ vai trò route/controller mỏng: parse query, resolve scope, gọi service và trả response.
- Report query GET được validate trong `reportFormRequest.ts`; history/audit query GET được validate trong `backend/src/modules/history/historyFormRequest.ts`.
- Query report nằm trong `reportRepository.ts`; tính toán rate, utilization và recommendation nằm trong `reportService.ts`.
- `reportScope.ts` resolve scope từ auth profile hiện tại:
  - `businessLocationId` lấy từ operational context/session đã qua `enforceScope`;
  - danh sách unit thao tác lấy từ `user.operationUnits`;
  - `unitConfigIds` là khóa lọc chính cho delivery/slot report.
- Query param `unit=<unitCode>` vẫn được giữ để tương thích frontend/API cũ, nhưng backend chỉ map unit code này vào các `UnitConfig.id` nằm trong scope được phép. Không dùng `receivingUnit` làm lớp bảo mật chính.
- `reportRepository.ts` dùng `unitConfigId` cho Prisma `where` và `unit_config_id`/`uc.id` trong raw SQL clause. Các group/report key có thể vẫn trả `receivingUnit` snapshot để không phá contract cũ, nhưng dữ liệu đầu vào đã được scope bằng `UnitConfig`.
- Frontend `Reports.tsx` load filter unit từ `GET /api/units/configs`; label/export ưu tiên `UnitConfig.shortName/displayName`, fallback legacy chỉ dùng khi thiếu metadata.
- Frontend `Reports.tsx` không giữ bảng label cố định cho `EMART`/`THISKYHALL`/`TENANT`; nếu API chưa trả label thì hiển thị mã unit gốc.
- `GET /api/histories/delivery` và `GET /api/histories/audit` cũng áp dụng `businessLocationId` và `unitConfigId` operation scope. Delivery history response được enrich `unitConfig` rút gọn để bảng lịch sử render unit bằng metadata DB.
- `GET /api/histories/delivery/:id/events` kiểm tra unit scope của history trước khi trả timeline; non-`SUPERADMIN` không được xem timeline của delivery history ngoài unit được cấp.
- `routes/analytics.ts` là route mỏng; thống kê live average, analyze và accept recommendation nằm trong `backend/src/modules/analytics`.
- Analytics routes dùng `authenticate + enforceScope`.
- `analyticsService.ts` resolve danh sách `unitConfigIds` từ auth profile hiện tại:
  - `user.operationUnits` nếu tài khoản có unit operation scope;
  - toàn bộ unit active trong selected/current `businessLocationId` cho role không cần unit scope nhưng đang ở operational context, ví dụ `SUPERADMIN`.
- `analyticsRepository.ts` lọc `ReceivingTimeConfig` và live delivery samples theo `unitConfigId`.
- Live receiving time stats group theo `unit_config_id + receiving_unit + vehicle_type + goods_type`; `receiving_unit` chỉ còn là snapshot/compat label.
- Response `GET /api/analytics/receiving-times` include `unitConfig` rút gọn để frontend render label/icon/màu theo dữ liệu DB.
- Frontend `ReceivingTimes.tsx` group theo `unitConfigId` động và dùng `unitPresentation.ts` để render label/icon/màu. Các delivery/config legacy thiếu metadata fallback generic từ mã unit.
- Date range trong reports cần thống nhất timezone VN nếu báo cáo theo ngày vận hành.
- `ReceivingTimeConfig` mới có `unitConfigId`; unique mới theo `[unitConfigId, vehicleType, goodsType]` để tránh lẫn cấu hình giữa nhiều `BusinessLocation`.
- Cột `unit` vẫn là code snapshot/compat cho report/API cũ.
- Superadmin có tab `Receiving time configs` và API `/api/superadmin/receiving-time-configs` để CRUD cấu hình theo `UnitConfig`.
