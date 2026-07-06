# Tài Liệu Tổng Quan Hệ Thống

Thư mục này chia tài liệu theo từng tính năng đang có trong hệ thống quản lý đăng ký, check-in, điều phối và theo dõi giao hàng.

Mỗi file tập trung vào một miền nghiệp vụ riêng:

- [auth-role-scope.md](auth-role-scope.md): đăng nhập, JWT, role và scope theo `BusinessLocation`.
- [app-config-advanced-auth.md](app-config-advanced-auth.md): cấu hình ứng dụng, IP nội bộ và Face ID/WebAuthn.
- [business-location-unit-zone-slot.md](business-location-unit-zone-slot.md): cây dữ liệu `BusinessLocation -> UnitConfig -> Zone -> Slot`.
- [driver-registration.md](driver-registration.md): luồng tài xế đăng ký giao hàng tại `/register`.
- [check-in-flow.md](check-in-flow.md): luồng check-in chuẩn qua user role `CHECKIN` và route `/check-in`.
- [receiving-dashboard-lifecycle.md](receiving-dashboard-lifecycle.md): dashboard điều phối, bắt đầu nhận hàng, hoàn tất, hủy.
- [auto-assign.md](auto-assign.md): logic tự động gọi xe vào slot.
- [realtime-socket.md](realtime-socket.md): Socket.IO rooms và realtime events.
- [track-pwa-push.md](track-pwa-push.md): trang tracking tài xế, web push, âm thanh và rung.
- [backoffice-configuration.md](backoffice-configuration.md): cấu trúc Backoffice và các tab cấu hình.
- [device-kiosk-terminal.md](device-kiosk-terminal.md): hiện trạng kiosk/device terminal và kế hoạch refactor.
- [operational-screens.md](operational-screens.md): waiting screen, dock management và màn hình vận hành.
- [auto-warehouse.md](auto-warehouse.md): vendor kho tự động và rule auto warehouse.
- [reports-analytics.md](reports-analytics.md): báo cáo và phân tích thời gian nhận hàng.
- [audit-log.md](audit-log.md): audit log thao tác quan trọng.
- [rate-limit-security.md](rate-limit-security.md): rate limit và bảo vệ public API.
- [timezone-expire.md](timezone-expire.md): timezone Việt Nam và expire stale deliveries.
- [seed-and-data-bootstrap.md](seed-and-data-bootstrap.md): seed demo, seed location/unit và seed app config.
- [testing-load-concurrency.md](testing-load-concurrency.md): concurrency test và load test Artillery.

Lưu ý quan trọng:

- Luồng vận hành chuẩn hiện tại nên đi qua các endpoint rõ ràng trong `/api/deliveries/*`.
- `/kiosk` đang được tách riêng thành tài liệu hiện trạng/kế hoạch vì endpoint `/api/checkin/scan` hiện có thể xử lý nhiều bước lifecycle trong một API; cần refactor trước khi xem là luồng chuẩn.
- Khi sửa code, đọc thêm `AGENTS.md` vì file đó chứa quy tắc bắt buộc và định hướng phát triển.
