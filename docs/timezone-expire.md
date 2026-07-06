# Timezone Việt Nam Và Expire Delivery Quá Hạn

## Mục Tiêu

Nghiệp vụ ngày/giờ dùng giờ Việt Nam, không phụ thuộc timezone máy chạy.

## Backend

Files:

- `backend/src/lib/dateVN.ts`
- `backend/src/services/expireStale.ts`
- `backend/src/index.ts`
- `backend/src/routes/dashboard.ts`

## Hàm Chính

Trong `dateVN.ts`:

- Các helper kiểm tra ngày VN và format ngày VN.

Trong `expireStale.ts`:

- `expireStaleDeliveries()`
  - Expire delivery `REGISTERED`/`WAITING` qua ngày theo rule giờ VN.
  - Chuyển status thành `EXPIRED`.
  - Ghi note lý do.

## Trigger

Tự động:

- Khi backend startup trong `backend/src/index.ts`.
- Lặp mỗi 1 giờ bằng `setInterval`.

Thủ công:

- `POST /api/dashboard/expire-stale`

## Rule Hiện Tại

- Sau 19:00 VN: expire các `REGISTERED`/`WAITING` trước cutoff 19:00 hôm nay.
- Trước 19:00 VN: chỉ expire bản ghi trước 00:00 hôm nay.

## Lưu Ý

- User từng yêu cầu cơ chế xóa/expire các lượt trong ngày không check-in lúc 00:00 theo ngày giao, không phải `createdAt`.
- Code hiện tại cần tiếp tục đối chiếu nếu muốn chạy đúng từng rule business mới nhất theo `requestedTime`.
- Không hard-delete delivery có lịch sử; nên dùng status `EXPIRED`.
