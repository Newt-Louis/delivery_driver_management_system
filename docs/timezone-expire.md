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
- `autoCancelCalledNoShowDeliveries()`
  - Chạy mỗi phút để hủy delivery `CALLED` đã được gọi vào slot nhưng không bắt đầu nhận hàng sau số phút cấu hình theo `UnitConfig`.
  - Lý do/message nghiệp vụ: `Tài xế check-in rồi nhưng không vào`.

## Trigger

Tự động:

- `close-daily-deliveries` chạy 23:59 theo timezone `Asia/Ho_Chi_Minh`.
- `archive-cancelled-deliveries` chạy cron mỗi 2 giờ.
- `auto-cancel-called-no-show` chạy cron mỗi phút.
- Scheduler chạy trong backend process qua `startOperationalScheduler()` và `node-cron`, không phải queue worker/container cron riêng.

Thủ công:

- `POST /api/dashboard/expire-stale` gọi manual job `closeDailyDeliveries()`.
- `GET /health/scheduler` trả trạng thái scheduler hiện tại.

## Rule Hiện Tại

- Job 23:59 quét theo `requestedTime` của ngày vận hành, fallback `createdAt`/`checkinTime` khi `requestedTime` null.
- `REGISTERED`: `EXPIRED`, lý do không tới check-in.
- `RECEIVING`/`AUTO_WAREHOUSE_RECEIVING`: `INCOMPLETED`, lý do chưa hoàn tất cuối ngày.
- `CANCELLED`: cron 120 phút archive/xóa sau khi đã có `cancelReason`.
- `CALLED`: nếu unit bật `autoCancelCalledEnabled` và quá `autoCancelCalledAfterMinutes` từ lần gọi gần nhất, hệ thống chuyển sang `CANCELLED`; row này ở lại bảng vận hành 120 phút trước khi archive như cancel thường.

## Lưu Ý

- Không xóa khỏi `delivery_registrations` trước khi ghi đủ `delivery_history`, `delivery_history_events` và `scheduler_job_histories`.
- Chi tiết xem thêm `docs/delivery-history-scheduler.md`.
