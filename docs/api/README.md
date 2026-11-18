# Tài Liệu API Cho App (Điện Thoại, TV, PDA)

Tài liệu hợp đồng REST và Socket.IO mà app bên ngoài dùng. Phản ánh code tại 2026-11-18 (sau Việc 6 trong `PLAN.md`).

| File | Nội dung |
|---|---|
| [public.md](public.md) | API không cần đăng nhập: đăng ký giao hàng, tra cứu/theo dõi chuyến, màn hình chờ (TV), brand, cấu hình đơn vị public, web push |
| [operations.md](operations.md) | API nội bộ cần đăng nhập: đăng nhập/phiên, check-in, dashboard điều phối, vòng đời chuyến, slot |
| [realtime.md](realtime.md) | Socket.IO: cách join phòng, danh sách event và payload |
| [CHANGELOG.md](CHANGELOG.md) | Nhật ký thay đổi hợp đồng theo ngày, đánh dấu BREAKING |

Không mô tả chi tiết ở đây: các API cấu hình của Backoffice/Superadmin (CRUD unit, zone, slot, user, thiết bị, kho tự động, khung giờ, báo cáo, lịch sử, seeding). Các API đó chỉ dùng cho web quản trị; xem `docs/backoffice-configuration.md` và mã nguồn `backend/src/routes/*`.

## Quy Ước Chung

- **Base URL:** cùng origin với web (`/api/...`). Docker/nginx proxy `/api` và `/socket.io` sang backend.
- **Định dạng:** JSON UTF-8. Thời gian là chuỗi ISO 8601 UTC (`2026-11-18T02:00:00.000Z`); app tự đổi sang giờ Việt Nam.
- **Xác thực:** header `Authorization: Bearer <token>`. Token lấy từ `POST /api/auth/login`; hết hạn thì `POST /api/auth/renew` hoặc đăng nhập lại. Web lưu token ở cookie `dqm_token`, app tự lưu.
- **Phạm vi dữ liệu (scope):**
  - Mọi tài khoản trừ `SUPERADMIN` gắn với một `BusinessLocation` (khu vực). API vận hành tự lọc theo khu vực đó; không truyền `businessLocationId` cho API nội bộ.
  - `RECEIVING`, `CHECKIN`, `ADMIN_OPE` có thể bị giới hạn theo đơn vị (`unitPermissions` trong response đăng nhập). Thao tác trên chuyến của đơn vị không được cấp trả `403`.
  - API public nhận scope qua query `businessLocationId` (hoặc `unitConfigId` ở một số API).
- **Role:** `SUPERADMIN`, `ADMIN_LOC`, `ADMIN_OPE`, `RECEIVING`, `CHECKIN`.

## Mã Lỗi

| HTTP | Khi nào | Body |
|---|---|---|
| 400 | Dữ liệu không hợp lệ (validate) | `{ "error": "Validation Error", "message": "field: lý do, …" }` |
| 400 | Lỗi nghiệp vụ | `{ "error": "<Code hoặc message>", "message": "…", …chi tiết }` |
| 401 | Thiếu/sai/hết hạn token | `{ "error": "…", "message": "…" }` |
| 403 | Không đủ role hoặc ngoài phạm vi khu vực/đơn vị | như trên |
| 404 | Không tìm thấy | như trên |
| 409 | Xung đột trạng thái (ví dụ chuyến không ở trạng thái cho phép, phiên đăng nhập đang tồn tại) | như trên, có thể kèm chi tiết |
| 429 | Vượt giới hạn tần suất (rate limit) | header `RateLimit-*` |
| 500 | Lỗi máy chủ | `{ "error": "Internal Server Error", "message": "…" }` |

Lỗi nghiệp vụ dùng chung dạng `{ error, message, ...details }`: `error` là mã ngắn (ví dụ `ActiveSessionExists`, `InvalidStatus`, `MissingScope`) hoặc câu thông báo; `message` là câu tiếng Việt hiển thị được cho người dùng.

## Giới Hạn Tần Suất (Public)

| Nhóm | Áp dụng cho | Giới hạn |
|---|---|---|
| `publicReadLimiter` | đọc public (board màn hình chờ, cấu hình đơn vị public, khả năng nhận xe) | 240 request/phút/IP |
| `publicWriteLimiter` | đăng ký, quick-verify, mã đăng ký thủ công, đăng ký push | xem `docs/rate-limit-security.md` |
| `publicLookupLimiter` | `GET /api/track/search` | xem `docs/rate-limit-security.md` |
| `authLoginLimiter` | đăng nhập, renew, Face ID | xem `docs/rate-limit-security.md` |

Nhiều TV sau cùng một IP: tải board một lần khi mở và khi kết nối lại, còn lại nhận qua socket (`waiting_board_updated`), không polling.

## Trạng Thái Chuyến (`DeliveryStatus`)

`REGISTERED` (đã đăng ký) → `WAITING` (đã check-in, có số thẻ) → `CALLED` (được gọi vào slot) → `RECEIVING` / `AUTO_WAREHOUSE_RECEIVING` (đang nhận hàng) → `COMPLETED`. Kết thúc khác: `CANCELLED`, `EXPIRED`, `INCOMPLETED`.

Loại xe (`VehicleType`): `TRUCK`, `MOTORBIKE`. Loại hàng (`GoodsType`): `FRESH_FOOD`, `AUTO_WAREHOUSE`, `GENERAL_GOODS`, `THI_CONG`.

## Số Thứ Tự (Số Thẻ)

Ghép từ `ticketNumber`: `<PREFIX>-<T|M><3 chữ số>`, ví dụ `EMART-T007`. `PREFIX` = `unitConfig.shortName`, nếu trống thì `displayName`, nếu trống nữa thì mã `unit`; bỏ dấu, chỉ giữ chữ và số, viết hoa. `T` = xe tải, `M` = xe máy. Board màn hình chờ trả sẵn `ticketCode`.

**Đơn vị của một chuyến luôn là `unitConfig` / `unitConfigId` / `receivingUnit` của chính chuyến**, không phải đơn vị sở hữu slot (`assignedSlot.zone.unitConfig`). Hai giá trị này khác nhau khi xe mượn slot của đơn vị khác.
