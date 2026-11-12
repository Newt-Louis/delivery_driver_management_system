# Seeding Dữ Liệu Mô Phỏng

## Mục Tiêu

Sinh hàng loạt dữ liệu vận hành trên môi trường local/UAT để tester mô phỏng tình huống thực tế: tải lớn ở dashboard/check-in, auto-assign, reconcile slot, concurrency, scheduler cuối ngày và phân tích thời gian nhận hàng. Seeding chỉ **thêm** dữ liệu, không xóa hay reset dữ liệu cũ. Khác với `db:bootstrap` (`seed-and-data-bootstrap.md`) chỉ dành cho database mới.

## Bật/Tắt

- Biến môi trường backend `ENABLE_SEEDING=true` mới cho chạy. Không đặt (hoặc khác `true`) thì API trả `403`.
- Chỉ bật trên local/UAT. Production không đặt biến này.

## Giao Diện

- `/backoffice`, góc phải tiêu đề: nút **SEEDING** (màu volcano) hiển thị cho tài khoản vào được Backoffice (`SUPERADMIN`, `ADMIN_LOC`).
- Bấm nút xổ dropdown các loại seed. Chọn một loại sẽ mở popup xác nhận **Đồng ý** / **Huỷ bỏ**; chỉ **Đồng ý** mới chạy.
- Xong hiển thị tóm tắt theo khu vực/đơn vị; invalidate query `dashboard`, `check-in`.

Files frontend:

- `frontend/src/features/seeding/constants.ts`: danh sách lựa chọn dropdown (`SEEDING_OPTIONS`).
- `frontend/src/features/seeding/components/SeedingMenuButton.tsx`
- `frontend/src/features/seeding/api.ts`, `types.ts`

## Backend

- `POST /api/seeding/run`, body `{ "type": "registered-deliveries" }`, role `SUPERADMIN` | `ADMIN_LOC`.
- Route không dùng `enforceScope` vì `SUPERADMIN` seed mọi khu vực kể cả khi chưa chọn khu vực vận hành; `ADMIN_LOC` bị giới hạn trong `businessLocationId` của mình ở service.
- `backend/src/routes/seeding.ts`: controller mỏng.
- `backend/src/modules/seeding/seedingTypes.ts`: registry loại seed + cờ môi trường.
- `backend/src/modules/seeding/seedingService.ts`: kiểm tra cờ, role, scope rồi điều phối theo `type`.
- `backend/src/modules/seeding/deliveryRegisteredSeeding.ts`: seed lượt đăng ký.
- `backend/src/modules/seeding/seedingData.ts`: NCC mẫu, tên tài xế, đầu số, biển số.

Thêm loại seed mới: thêm key vào `SEEDING_TYPES`, thêm nhánh trong `runSeeding()`, thêm lựa chọn vào `SEEDING_OPTIONS` ở frontend.

## Loại `registered-deliveries`

Phạm vi:

- `SUPERADMIN`: mỗi `BusinessLocation` active nhận 100 lượt.
- `ADMIN_LOC`: chỉ khu vực được gán, 100 lượt.

Dữ liệu đích được đọc từ database lúc chạy, không hardcode location/unit:

- Unit: `UnitConfig` active của khu vực, có ít nhất một slot active không `MAINTENANCE`/`RESERVED` thuộc unit (cùng rule với vehicle availability).
- Loại hàng: `FRESH_FOOD`, `GENERAL_GOODS`, `THI_CONG` theo cờ bật của unit; nếu có `UnitGoodsType` enabled cùng base type thì dùng từng loại tùy biến (`unitGoodsTypeId`). Chủ nhật với `sundayFreshFoodOnly` chỉ `FRESH_FOOD`. Không bao giờ chọn `AUTO_WAREHOUSE` làm loại hàng đầu vào.
- Loại xe: `TRUCK`, `MOTORBIKE`.

Phân bổ:

- 100 lượt chia đều cho các unit đủ điều kiện (phần dư cho unit đầu theo thứ tự mã unit).
- Trong mỗi unit, xoay vòng tổ hợp loại hàng × loại xe nên xe tải/xe máy xen kẽ và đủ mọi loại hàng.

Nội dung mỗi lượt:

- `status = REGISTERED`, `requestedTime` = 00:00 giờ VN hôm nay (giống luồng thủ công), `createdAt` = thời điểm seed.
- Luôn có `vendorCode` + `vendorName`. Mã lấy xoay vòng từ 30 NCC mẫu cố định `NCC10001`–`NCC10030` trong `seedingData.ts`; nếu unit đã có vendor kho tự động active, khoảng 1/5 lượt hàng không phải thi công dùng vendor đó. Mã NCC nào nằm trong danh sách kho tự động active của unit thì lượt thành `AUTO_WAREHOUSE`, `autoWarehouse = true`, `originalGoodsType` giữ loại gốc — giống `registerDelivery()`. Muốn có thêm lượt kho tự động, thêm mã NCC mẫu vào tab Kho tự động trước khi seed.
- `poNumber`: PO `450xxxxxxx` cho hàng tươi sống/hàng tổng hợp, mã Thi Công 5 ký tự (có chữ) cho hàng thi công. Khoảng 25% mã mới được 2–3 xe khác biển số dùng chung (một đơn tách nhiều xe).
- Biển số định dạng VN (`51C-123.45`, `59X1-123.45`), không trùng biển số đã có trong khu vực hôm nay (kể cả history). Kiểm tra dưới cùng advisory lock `registration-duplicate:*` của luồng đăng ký thật.
- Tên tài xế, số điện thoại 10 số ngẫu nhiên.
- `note = "Dữ liệu mô phỏng tự sinh"` để phân biệt khi xem báo cáo.

An toàn và nhất quán:

- Mỗi khu vực chạy trong một transaction (tất cả hoặc không), tuần tự từng khu vực.
- `pg_try_advisory_xact_lock` theo khu vực: lần bấm thứ hai trong lúc đang chạy bị bỏ qua với thông báo, không chạy chồng.
- `registrationCode` cấp qua `reserveRegistrationCode()`; event `REGISTERED` ghi `DeliveryHistoryEvent` với actor `SYSTEM` `seeding:registered-deliveries`.
- Audit `seeding.registered_deliveries` (actor là user bấm, target `BusinessLocation`).
- Sau commit emit `queue_updated` cho từng unit.
- Bỏ qua ước lượng công suất ngày của luồng thủ công (giống đăng ký PO/Thi Công đã xác thực) để seed lớn không bị `SlotFull`.

Response trả `deliveryDate`, `totalCreated` và tóm tắt theo khu vực (`SEEDED` / `SKIPPED` / `FAILED`) và unit (theo loại xe, loại hàng, số mã đơn dùng chung).
