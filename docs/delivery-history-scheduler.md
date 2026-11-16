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

`registration_history` lưu mỗi lượt đăng ký thành công từ `/register` và `/register-manual` (seeding không ghi):

- Snapshot thông tin đăng ký: mã, khu vực, đơn vị, NCC, mã PO/Thi Công, tài xế, SĐT, biển số, loại xe/hàng, ghi chú.
- `registrationSource`: `QUICK` hoặc `MANUAL`.
- `deviceType`: `MOBILE` (điện thoại/máy tính bảng) hoặc `DESKTOP`, suy ra từ gợi ý `clientDevice.mobile` của frontend, User-Agent và header `Sec-CH-UA-Mobile`. Không lưu tên đời máy hay IP.
- `userAgent`: chuỗi gốc tối đa 512 ký tự, chỉ để IT tra cứu trong database, không trả ra API.
- `supersededAt`, `supersededByCode`, `supersededByRegistrationId`: có giá trị khi lượt bị thay thế bởi lần đăng ký lại cùng biển số/khu vực/ngày/mã.
- Lưu vĩnh viễn, chưa có job dọn. Lượt đăng ký trước khi có bảng chỉ được ghi lịch sử khi bị thay thế.

Bảng này là bằng chứng đối chiếu (ví dụ tài xế đăng ký nhiều lần rồi dùng QR cũ), không tham gia vận hành, báo cáo hay `delivery_history`.

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

- `close-daily-deliveries`: chạy 00:00 theo `Asia/Ho_Chi_Minh` để xử lý ngày Việt Nam vừa kết thúc; chạy thủ công vẫn mặc định ngày hiện tại.
  - `REGISTERED` trong ngày vận hành nhưng không check-in: đánh dấu `EXPIRED`, ghi history/events, xóa khỏi bảng vận hành.
  - `RECEIVING` hoặc `AUTO_WAREHOUSE_RECEIVING` cuối ngày: đánh dấu `INCOMPLETED`, ghi history/events, reconcile/release slot, xóa khỏi bảng vận hành.
  - Khóa từng dòng, kiểm tra lại điều kiện và thực hiện đổi trạng thái, archive và xóa trong một transaction; lượt không còn đủ điều kiện được bỏ qua.
- `archive-deliveries`: chạy mỗi 120 phút.
  - Với `COMPLETED`, kiểm tra snapshot lịch sử theo từng lô; giữ nguyên snapshot đã có và xóa dòng vận hành nếu lịch sử vẫn tồn tại với trạng thái `COMPLETED`. Nếu thiếu snapshot, ghi lịch sử trước khi xóa; nếu snapshot có trạng thái khác, báo lỗi và giữ dòng vận hành.
  - Với `CANCELLED`, giữ rule cũ: archive/xóa các lượt đã có `cancelReason` và quá cutoff 120 phút.
- `auto-cancel-called-no-show`: chạy mỗi phút.
  - Quét delivery `CALLED` của unit đang bật `UnitConfig.autoCancelCalledEnabled`.
  - Tính thời gian quá hạn từ event gọi gần nhất trong `delivery_history_events`: `AUTO_ASSIGNED`, `MANUAL_CALLED`, `RECALLED`, `REASSIGNED_SLOT`; fallback về `calledTime` nếu thiếu event.
  - Khi quá `autoCancelCalledAfterMinutes`, chuyển delivery sang `CANCELLED`, ghi reason/message `Tài xế check-in rồi nhưng không vào`, release slot, emit realtime và trigger auto-assign tiếp.
  - Row operational `CANCELLED` không bị archive ngay; `archive-deliveries` sẽ xóa/archive sau 120 phút như cancel thường.

Mỗi job run đều ghi `scheduler_job_histories`.

Scheduler hiện chạy trong chính backend process qua `startOperationalScheduler()` sau khi server listen. `schedulerService.ts` dùng `node-cron` cho lịch chạy thật, có guard `isRunning` để tránh overlap, graceful stop khi process nhận `SIGTERM`/`SIGINT`, và endpoint `GET /health/scheduler` để xem `nextRunAt`, `lastRunAt`, `isRunning`, `lastProcessed`, `lastSucceeded`, `lastFailed` của từng job.

Health trả `deliveryArchive`; `cancelledArchive` vẫn là alias tương thích cho consumer cũ. Sau khi dòng `COMPLETED` được dọn, API tracking theo mã không còn tìm thấy chuyến đó; lịch sử và timeline vẫn được giữ.

Hiện chưa có queue worker riêng. Scheduler chỉ quyết định khi nào kích hoạt job; nếu sau này cần retry/backoff/dedupe phức tạp hoặc job dài, queue/worker sẽ là một tầng thiết kế khác.

## History Module

Module chính:

- `backend/src/modules/history/types.ts`
- `backend/src/modules/history/historyRepository.ts`
- `backend/src/modules/history/historyService.ts`
- `backend/src/modules/history/archiveService.ts`
- `backend/src/modules/history/historyFormRequest.ts`

Nguyên tắc:

- `AuditLog` vẫn là lịch sử thao tác của user/system.
- `delivery_history_events` là timeline nghiệp vụ của chuyến giao hàng.
- Không dùng lại `CallLog`; số lần gọi xe được đếm từ event gọi xe.
- `StaffPin` và `/api/staff-pins` đã bị loại khỏi luồng vận hành.

## Frontend

- Dashboard hiển thị số lần gọi từ `callCount`.
- Dashboard bắt buộc nhập lý do khi hủy chuyến.
- Trang Histories đọc danh sách lịch sử từ `delivery_history` qua `/api/histories/delivery`.
- Tab **Đăng ký** của Histories đọc `registration_history` qua `/api/histories/registrations` (role `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, scope theo `businessLocationId` và unit được phân quyền). Bảng hiển thị trạng thái "Lượt được sử dụng"/"Đã bị thay thế bởi … lúc …", số lần đăng ký trong ngày của biển số, nhãn "Đăng ký trên điện thoại"/"Đăng ký trên máy tính" và hình thức đăng ký; lọc theo trạng thái, đơn vị, loại xe, ngày và tìm theo biển số/mã/PO/tài xế/SĐT.
- Double-click một dòng lịch sử trong Histories để mở modal timeline từ `delivery_history_events`.
- Feature Histories nằm trong `frontend/src/features/histories`, gồm API helper, hooks, bảng giao/nhận, bảng audit, modal timeline/audit detail, formatter dùng chung và component bảng/pagination dùng chung.
