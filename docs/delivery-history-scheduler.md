# Scheduler Và Lịch Sử Chuyến Giao Hàng

## Mục Tiêu

Giai đoạn 3 tách hai trách nhiệm mới:

- `delivery_registrations`: bảng vận hành realtime, phục vụ queue/dashboard/track khi lượt giao hàng còn active.
- `delivery_history` và `delivery_history_events`: dữ liệu lịch sử dài hạn cho báo cáo, đối soát và timeline chi tiết.
- `scheduler_job_histories`: lịch sử các job nền đã chạy.

## Bảng Dữ Liệu

`delivery_history` lưu snapshot một dòng cho mỗi lượt giao/nhận đã đóng hoặc bị archive:

- Mã đăng ký, tài xế, nhà cung cấp, xe, unit, loại hàng.
- Các mốc thời gian: đăng ký, check-in, gọi vào slot, bắt đầu nhận, hoàn tất.
- `finalStatus`: `COMPLETED`, `CANCELLED`, `EXPIRED`, `INCOMPLETED`.
- `closeReason`, `callCount`, slot snapshot, duration và metadata.

`delivery_history_events` lưu timeline nhiều dòng:

- `REGISTERED`
- `CHECKED_IN`
- `AUTO_ASSIGNED`
- `MANUAL_CALLED`
- `RECALLED`
- `REASSIGNED_SLOT`
- `RECEIVING_STARTED`
- `AUTO_WAREHOUSE_RECEIVING_STARTED`
- `COMPLETED`
- `CANCELLED`
- `EXPIRED_NO_SHOW`
- `EXPIRED_WAITING`
- `INCOMPLETED`
- `ARCHIVED`

`scheduler_job_histories` lưu:

- Tên job.
- Ngày vận hành.
- Timezone.
- Trigger.
- Trạng thái chạy.
- Số bản ghi processed/succeeded/failed.
- Lỗi nếu có.

## Scheduler

Module chính:

- `backend/src/modules/scheduler/schedulerService.ts`
- `backend/src/modules/scheduler/deliveryJobs.ts`
- `backend/src/modules/scheduler/jobHistory.ts`

Job hiện có:

- `close-daily-deliveries`: chạy 23:59 theo `Asia/Ho_Chi_Minh`.
  - `REGISTERED` trong ngày vận hành nhưng không check-in: đánh dấu `EXPIRED`, ghi history/events, xóa khỏi bảng vận hành.
  - `RECEIVING` hoặc `AUTO_WAREHOUSE_RECEIVING` cuối ngày: đánh dấu `INCOMPLETED`, ghi history/events, reconcile/release slot, xóa khỏi bảng vận hành.
- `archive-cancelled-deliveries`: chạy mỗi 120 phút.
  - Archive/xóa các lượt `CANCELLED` đã có `cancelReason` và quá cutoff 120 phút.

Mỗi job run đều ghi `scheduler_job_histories`.

## History Module

Module chính:

- `backend/src/modules/history/types.ts`
- `backend/src/modules/history/historyRepository.ts`
- `backend/src/modules/history/historyService.ts`
- `backend/src/modules/history/archiveService.ts`

Nguyên tắc:

- `AuditLog` vẫn là lịch sử thao tác của user/system.
- `delivery_history_events` là timeline nghiệp vụ của chuyến giao hàng.
- Không dùng lại `CallLog`; số lần gọi xe được đếm từ event gọi xe.
- `StaffPin` và `/api/staff-pins` đã bị loại khỏi luồng vận hành.

## Frontend

- Dashboard hiển thị số lần gọi từ `callCount`.
- Dashboard bắt buộc nhập lý do khi hủy chuyến.
- Reports đọc danh sách lịch sử từ `delivery_history`.
- Double-click một dòng lịch sử để mở modal timeline từ `delivery_history_events`.
