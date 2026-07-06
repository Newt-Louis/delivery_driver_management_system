# Kiểm Thử Đồng Thời Và Load Test

## Mục Tiêu

Hệ thống có các test để bắt race condition và load test để đo khả năng chịu tải khi nhiều tài xế/request đồng thời.

## Backend Scripts

Trong `backend/package.json`:

- `npm run test:concurrency`
- `npm run test:load`

## Concurrency Test

File:

- `backend/src/tests/concurrency.test.ts`

Mục tiêu test:

- Nhiều check-in đồng thời không trùng ticket.
- Scan/check-in cùng một QR không cấp ticket nhiều lần.
- Manual call đồng thời chỉ tạo một `CallLog`.
- Multi-capacity slot không vượt `maxCapacity`.
- Complete đồng thời không release/auto-assign lặp.
- Auto-assign không đưa `AUTO_WAREHOUSE` vào slot thường.
- Ưu tiên `FRESH_FOOD`.

Lệnh:

```bash
cd backend
npm run test:concurrency
```

## Load Test

Files:

- `backend/load-test.yml`
- `backend/processor.js`

Thư viện:

- `artillery`

Script:

```bash
cd backend
npm run test:load
```

Nội dung:

- Tạo nhiều virtual users.
- Register/check-in flow.
- Cleanup dữ liệu load test sau scenario.
- Threshold:
  - `maxErrorRate < 1`
  - `p95 < 1500`

## Lỗi Từng Bắt Được

Load test đã bắt lỗi sinh `registrationCode` bằng `count + 1` gây 500 khi đồng thời. Đã fix bằng:

- Model `RegistrationSequence`
- Service `reserveRegistrationCode()`
- Migration `20260701090000_add_registration_sequences`

## Lưu Ý

- Test cần PostgreSQL local.
- Nếu sandbox không truy cập được DB/container, cần chạy ngoài sandbox.
- Artillery là load test ứng dụng, không thay thế test concurrency transactional.
