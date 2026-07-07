# Timezone Việt Nam Và Expire Delivery Quá Hạn

## Mục Tiêu

Nghiệp vụ ngày/giờ dùng giờ Việt Nam, không phụ thuộc timezone máy chạy.

## Backend

Files:

- `backend/src/lib/dateVN.ts`
- `backend/src/modules/scheduler/deliveryJobs.ts`
- `backend/src/modules/scheduler/schedulerService.ts`
- `backend/src/modules/history/archiveService.ts`
- `backend/src/index.ts`
- `backend/src/routes/dashboard.ts`

## Hàm Chính

Trong `dateVN.ts`:

- Các helper kiểm tra ngày VN và format ngày VN.

Trong scheduler/history module:

- `closeDailyDeliveries()`
  - Chạy theo ngày vận hành Việt Nam.
  - Đánh dấu `REGISTERED` không tới check-in thành `EXPIRED`.
  - Đánh dấu `RECEIVING`/`AUTO_WAREHOUSE_RECEIVING` chưa hoàn tất cuối ngày thành `INCOMPLETED`.
  - Ghi `delivery_history`, `delivery_history_events`, `scheduler_job_histories`, rồi xóa khỏi bảng vận hành khi job archive.
- `archiveCancelledDeliveries()`
  - Chạy mỗi 120 phút để archive/xóa các lượt `CANCELLED` đã có reason và quá cutoff.

## Trigger

Tự động:

- `close-daily-deliveries` chạy 23:59 theo timezone `Asia/Ho_Chi_Minh`.
- `archive-cancelled-deliveries` chạy mỗi 120 phút.

Thủ công:

- `POST /api/dashboard/expire-stale` gọi manual job `closeDailyDeliveries()`.

## Rule Hiện Tại

- Job 23:59 quét theo `requestedTime` của ngày vận hành, fallback `createdAt`/`checkinTime` khi `requestedTime` null.
- `REGISTERED`: `EXPIRED`, lý do không tới check-in.
- `RECEIVING`/`AUTO_WAREHOUSE_RECEIVING`: `INCOMPLETED`, lý do chưa hoàn tất cuối ngày.
- `CANCELLED`: cron 120 phút archive/xóa sau khi đã có `cancelReason`.

## Lưu Ý

- Không xóa khỏi `delivery_registrations` trước khi ghi đủ `delivery_history`, `delivery_history_events` và `scheduler_job_histories`.
- Chi tiết xem thêm `docs/delivery-history-scheduler.md`.
