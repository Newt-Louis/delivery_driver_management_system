# Luồng Tài Xế Đăng Ký Giao Hàng

## Mục Tiêu

Tài xế/NCC sử dụng các trang public, không cần đăng nhập:

- `/`: trang chủ với hai nút đăng ký giao hàng và theo dõi chuyến.
- `/register`: luồng đăng ký mặc định bằng mã PO/Thi Công và API Config.
- `/register-manual`: luồng đăng ký thủ công, dùng khi nhập từ bản giấy hoặc khi hệ thống/API online gặp sự cố.

Sau khi đăng ký thành công qua luồng thủ công hiện tại, tài xế nhận:

- `registrationCode`
- QR code/tracking code
- Nút theo dõi hành trình tự động đếm ngược và chuyển sang `/track/:code`

## Frontend

Files:

- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/RegisterManual.tsx`
- `frontend/src/features/register-manual/hooks/useRegisterForm.ts`
- `frontend/src/features/register-manual/api.ts`
- `frontend/src/features/register-manual/types.ts`
- `frontend/src/features/register-manual/constants.ts`
- `frontend/src/features/register-manual/steps/UnitGoodsVehicleStep.tsx`
- `frontend/src/features/register-manual/steps/ScheduleStep.tsx`
- `frontend/src/features/register-manual/steps/DriverInfoStep.tsx`
- `frontend/src/features/register-manual/steps/ReviewSubmitStep.tsx`
- `frontend/src/features/register-manual/components/SuccessScreen.tsx`
- `frontend/src/features/register-manual/components/FieldFrame.tsx`
- `frontend/src/features/register-manual/components/FieldFeedback.tsx`

Routes:

- `/` render `Home.tsx` với hai nút dẫn đến `/register` và `/track`. Nếu chưa có khu vực public được lưu, người chưa đăng nhập và `SUPERADMIN` thấy modal chọn khu vực; modal có thể đóng và xuất hiện lại khi quay về trang chủ nếu vẫn chưa chọn.
- `/register` render `Register.tsx` cho đăng ký bằng mã PO/Thi Công.
- `/register-manual` render `RegisterManual.tsx` và giữ wizard thủ công.
- `/taixe` hiện vẫn redirect sang `/register`.
- Header public không có nút đăng nhập hoặc menu tài khoản. Nhân sự truy cập `/login` trực tiếp để đăng nhập; menu tài khoản nội bộ không có mục chuyển khu vực public/nội bộ.

Trang đăng ký `/register` hiện có:

- Lời chào `Hệ thống điều phối nhận hàng THISO`.
- Ô nhập mã PO/Thi Công.
- Nút lớn `Quét QR hoặc Barcode tại đây` mở scanner thật; trong dialog quét có thêm nút chọn ảnh mã QR từ thư viện. Cả hai cách đều tách mã PO/Thi Công từ nội dung quét và tự điền vào ô nhập mã, không tự submit.
- Bên dưới phần kiểm tra mã có nút **Đăng ký thủ công** dẫn đến `/register-manual`; mục này không nằm trong menu public.
- Validate format cơ bản phía client:
  - PO: 10 chữ số, bắt đầu bằng `450`, không có khoảng trắng.
  - Thi Công: đúng 5 ký tự chữ/số, có ít nhất một chữ và không được toàn số, không có khoảng trắng.
- Step 1 gọi `POST /api/deliveries/quick-verify` để backend kiểm tra mã bằng API bên thứ 3 theo cấu hình trong `app_configs`.
- Step 2 PO nhập thông tin tài xế/xe/NCC và chọn xe tải hoặc xe máy, mặc định xe tải; ngày từ API PO phải là ngày hiện tại theo giờ Việt Nam. Số điện thoại, biển số và loại xe là bắt buộc.
- Step 2 Thi Công nhập thông tin tài xế/xe/NCC, chọn loại xe (mặc định xe tải) và loại hàng; ngày giao là ngày hiện tại do backend xác định theo giờ Việt Nam, không chọn ngày trên lịch.
- Step 3 review đầy đủ dữ liệu đã chuẩn hóa rồi submit đăng ký.

Wizard thủ công `/register-manual`:

1. Dùng `BusinessLocation` đã chọn qua tên khu vực trên public header; chọn đơn vị giao, loại hàng và loại xe trong wizard. Người chưa đăng nhập và `SUPERADMIN` có thể mở bộ chọn; các role đăng nhập khác chỉ xem tên. Khi đổi khu vực toàn cục, wizard quay về bước 1 và xóa các lựa chọn phụ thuộc.
2. Ngày giao hàng là ngày hiện tại theo giờ Việt Nam do backend trả cùng Mã đối chiếu 7 ký tự; tài xế không chọn ngày. Công suất của ngày hiện tại vẫn được kiểm tra. Người dùng có thể nhập hoặc chọn Mã NCC trước Tên công ty / Nhà cung cấp; mã giữ nguyên chữ hoa/thường đã nhập.
3. Nhập thông tin tài xế và phương tiện.
4. Review và hoàn tất đăng ký.

Logic trong `useRegisterForm.ts`:

- Nhận `businessLocationId` từ `PublicBusinessLocationContext`; context chung là nơi lấy danh sách public `GET /api/units/public/business-locations` và lưu lựa chọn thiết bị.
- Theo khu vực toàn cục, lấy unit active: `GET /api/units/public/configs?businessLocationId=...`.
- Lấy cấu hình unit: `GET /api/units/:unit/config?businessLocationId=...&unitConfigId=...`.
- Lấy loại hàng tùy biến: `GET /api/units/:unit/goods-types?businessLocationId=...&unitConfigId=...`. Dữ liệu nằm trong `unit_goods_types`, scope chính theo `unitConfigId` để không lẫn giữa các `BusinessLocation`.
- Lấy vehicle availability: `GET /api/units/:unit/vehicle-availability?businessLocationId=...&unitConfigId=...`.
- Có slot vận hành thì tài xế chọn được cả `TRUCK` và `MOTORBIKE`; số vị trí và sức chứa trả về là tổng dùng chung của đơn vị, không khẳng định slot chỉ nhận loại xe đó. Khi đăng ký, loại xe là bắt buộc và không còn giá trị `OTHER`.
- Lấy thống kê mật độ đăng ký theo ngày: `GET /api/units/:unit/daily-registration-stats?month=YYYY-MM&goodsType=...&vehicleType=...&businessLocationId=...&unitConfigId=...`.
- Check vendor kho tự động: `GET /api/aw-vendors/check?code=...&unit=...&businessLocationId=...&unitConfigId=...`.
- Gợi ý mã NCC ở step thông tin đơn hàng: `GET /api/aw-vendors/suggestions?q=...&businessLocationId=...&unitConfigId=...`. Endpoint chỉ trả tối đa 10 NCC active thuộc đúng `UnitConfig` public đang chọn; chọn một gợi ý sẽ điền lại cả mã lẫn tên NCC; mã người dùng nhập không bị ép đổi hoa/thường.
- Tạo mã đối chiếu thủ công: `POST /api/deliveries/manual-registration-code` trả mã và `deliveryDate` theo ngày Việt Nam của server. Frontend gọi khi vào step 2, giữ trong form và gọi lại cho lượt mới sau khi hoàn tất/reset.
- Submit: `POST /api/deliveries/register` với `businessLocationId`, `unitConfigId`, unit code snapshot và `deliveryDate`; backend kiểm tra ngày hiện tại và tự lưu `requestedTime` tại `00:00` giờ Việt Nam nếu payload không gửi giờ. Nếu client không gửi ngày, backend tự dùng ngày hiện tại.
- Scroll tới field lỗi đầu tiên khi validate fail.
- Khi sửa từ step review, bấm tiếp theo quay lại step 4.

Các step trong `frontend/src/features/register-manual/*` thuộc wizard thủ công; một số API, component và helper được trang đăng ký mặc định dùng chung.

## Backend

API chính:

- `POST /api/deliveries/register`
- `POST /api/deliveries/manual-registration-code`
- `POST /api/deliveries/quick-verify`
- `GET /api/units/public/business-locations`
- `GET /api/units/public/configs`
- `GET /api/units/:unit/config`
- `GET /api/units/:unit/goods-types`
- `GET /api/units/:unit/vehicle-availability`
- `GET /api/units/:unit/slots`
- `GET /api/units/:unit/daily-registration-stats`
- `GET /api/units/order-codes`
- `GET /api/aw-vendors/check`
- `GET /api/aw-vendors/suggestions`

Module backend:

- `backend/src/routes/deliveries.ts`: controller mỏng cho endpoint đăng ký và lifecycle delivery.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: validate payload đăng ký, check-in lookup, call/cancel và query list.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery, queue, resolve `UnitConfig`, capacity ước lượng theo ngày, duplicate theo ngày giao và auto-warehouse vendor.
- `backend/src/modules/deliveries/deliveryService.ts`: rule đăng ký, duplicate theo `vehiclePlate + driverPhone + poNumber` trong ngày giao khi có mã PO/Thi Công, capacity lock theo ngày, Sunday fresh-food-only, history event và response.
- `backend/src/modules/deliveries/quickRegistrationService.ts`: đọc API Config, gọi API PO/Thi Công bên thứ 3, log response thật, chuẩn hóa location/unit/goods/date và phát token xác thực ngắn hạn cho submit cuối.
- `backend/src/routes/units.ts`: controller mỏng cho unit config, goods type, vehicle availability và slot availability public.
- `backend/src/modules/units/unitFormRequest.ts`: validate params/query/body của unit API.
- `backend/src/modules/units/unitRepository.ts`: query cấu hình unit, khung giờ, slot vận hành và booking active.
- `backend/src/modules/units/unitService.ts`: rule nhận loại hàng, tính capacity theo slot active và strip secret khỏi public config.
- `backend/src/modules/units/orderCodeMock.ts`: danh sách mock 20 mã PO và 20 mã Thi Công trong lúc API thật chưa có.

Hàm quan trọng trong module:

- `normalizeVehiclePlate()` trong `deliveryRepository.ts`.
- `normalizeDriverPhone()` và `normalizeOrderCode()` trong `deliveryRepository.ts`.
- `findDuplicateRegistration()` trong `deliveryRepository.ts`.
- `ensureRegistrationDailyCapacity()` trong `deliveryService.ts`.
- `isSundayDeliveryDate()` trong `deliveryService.ts`.
- `getDailyRegistrationStats()`, `getAvailableSlots()` legacy/public và `getVehicleAvailability()` trong `modules/units/unitService.ts`.

Service:

- `backend/src/services/registrationSequence.ts`
  - `reserveRegistrationCode()` cấp registration code atomic theo ngày VN và `UnitConfig`.

## Rule Nghiệp Vụ

- Biển số xe được normalize uppercase và bỏ khoảng trắng.
- Số điện thoại duplicate được normalize chỉ còn chữ số.
- Luồng thủ công `/register-manual` không nhập mã PO/Mã thi công. Ở step 2, API sinh Mã đối chiếu gồm 7 ký tự chữ/số in hoa và frontend lưu mã đó vào `poNumber` của delivery; không có bảng sequence hoặc kiểm tra trùng riêng cho mã này.
- Mã đối chiếu được hiển thị ở step review, màn hình thành công và trang track.
- Luồng đăng ký nhanh cho phép mã thật ngoài danh sách mock nếu payload submit có `quickVerificationToken` hợp lệ do `POST /api/deliveries/quick-verify` phát hành.
- `registrationCode` có format `BUSINESSLOCATIONCODE + 4 ký tự cuối của UnitConfig.id + YYMMDD + số thứ tự ba chữ số`. Số thứ tự reset theo ngày và `UnitConfig`; mã location và suffix UnitConfig giữ mã đăng ký unique toàn cục để `/track/:code` và check-in không cần thêm scope.
- `BusinessLocation` public là phạm vi chung của các route public, không phải field trong wizard `/register-manual`; frontend không hardcode danh sách unit. Unit hiển thị từ `unit_configs` active của khu vực được chọn toàn cục.
- Submit register phải có `unitConfigId`. Backend validate `unitConfigId` active, thuộc `businessLocationId` đã chọn và có unit code trùng `receivingUnit`.
- Duplicate registration chỉ bị chặn khi cùng ngày giao đã chọn có lượt active trùng đủ cả ba thông tin `vehiclePlate + driverPhone + poNumber` trong cùng `unitConfigId`. Với luồng thủ công, `poNumber` là Mã đối chiếu tự sinh.
- Cùng biển số vẫn được đăng ký ngày khác, hoặc cùng ngày nhưng khác số điện thoại/Mã đối chiếu.
- Nếu unit bật `sundayFreshFoodOnly`, ngày Chủ nhật chỉ cho `FRESH_FOOD`.
- Backend validate lại capacity ước lượng theo ngày khi submit để tránh frontend bị stale.
- Capacity ngày tính theo:
  - `unitConfigId`
  - unit code snapshot
  - vehicleType
  - deliveryDate
  - active statuses: `REGISTERED`, `WAITING`, `CALLED`, `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING`
- Capacity ngày lấy từ `DeliveryTimeWindow` enabled cộng với `truckSlotMinutes`/`motorbikeSlotMinutes` và `truckMaxPerSlot`/`motorbikeMaxPerSlot`. `DeliveryTimeWindow` không còn sinh các ô giờ cho `/register-manual`; nó chỉ còn phục vụ ước lượng công suất ngày và đo lường vận hành.
- Capacity không tách theo `goodsType` khi đếm lượt đã đăng ký; `goodsType` dùng để chọn đúng nhóm time window ước lượng và rule eligibility.
- `UnitGoodsType`, `DeliveryTimeWindow` và `AutoWarehouseVendor` có `unitConfigId` là scope chính; cột `unit` là code snapshot/compat cho API theo `:unit`.
- Nếu unit có custom goods type enabled, frontend hiển thị danh mục custom đó; nếu không có time window riêng cho custom type thì backend/frontend fallback về time window base goods type của cùng unit.

## Luồng Online Trên `/register`

Endpoint verify:

- `POST /api/deliveries/quick-verify`
- Body: `{ "code": "..." }`
- Backend tự phân loại mã:
  - `PO` nếu mã có đúng 10 chữ số và bắt đầu bằng `450`.
  - `Thi Công` nếu mã có đúng 5 ký tự chữ/số, có ít nhất một chữ và không được toàn số.
- Backend đọc config theo key cố định:
  - PO: `api.settings.po_verify`.
  - Thi Công: `api.settings.thi_cong_verify`.
- Config không được hardcode endpoint hoặc credential trong source. Giá trị request cố định nên nằm trong `payload`, `payload_defaults` hoặc `payloadDefaults` của `app_configs`, riêng PO hiện backend luôn ép `BUKRS = VN01` và `EBELN = <mã PO tài xế nhập>`.
- Auth lấy từ `value.auth.header` trong `app_configs`.
- Backend log response thật của API bên thứ 3 để đối chiếu trong giai đoạn tích hợp.
- Backend không trả raw response của bên thứ 3 xuống frontend; frontend chỉ nhận dữ liệu đã chuẩn hóa.
- Lỗi kết nối, cấu hình, HTTP 400/401/403/5xx hoặc phản hồi thiếu dữ liệu của API kiểm tra được phân loại bằng mã lỗi riêng; `/register` đưa ra nút **Đăng ký thủ công**. HTTP 404 từ API đối tác vẫn được xem là mã không tồn tại; phản hồi Thi Công HTTP 200 với `success: false` vẫn là xác thực không thành công và không hiện nút. HTTP 400 của đối tác không đủ thông tin trong contract hiện tại để phân biệt mã sai với lỗi request, nên được xem là không thể kiểm tra.

PO normalization:

- `WERKS` map sang `BusinessLocation.code`: `1001 -> PVT`, `1002 -> SALA`, `1003 -> PHI`, `2001 -> THT`.
- Unit PO hiện match biến cấu hình nội bộ `EMART` với `unit_configs.unit` sau khi normalize để dễ mở rộng unit khác về sau.
- `EINDT` dạng `yyyyMMdd` được đổi thành `deliveryDate` và phải trùng ngày hiện tại theo giờ Việt Nam; nếu không, mã không được xác thực thành công.
- Backend lấy dòng đầu tiên trong `ITEMS`; `LIFNR` điền `vendorCode`, `VENDORNA` điền `vendorName` nếu có.
- `FRESH` từ SAP là string `"true"`/`"false"` nên backend normalize hoa/thường rồi đổi sang boolean: `true` thành `FRESH_FOOD`, `false` thành `GENERAL_GOODS`.
- Nếu response PO HTTP 200 nhưng không có dòng đầu tiên trong `ITEMS`, backend trả lỗi cấu trúc dữ liệu để tránh đăng ký sai khu vực/ngày.

Thi Công normalization:

- `data.scope.location` match `business_locations.code`.
- `data.scope.unit` fuzzy match trong `unit_configs.unit` của location, hỗ trợ các biến thể `thisky`, `thiskyhall`, `mall`, `thiso mall`, `thisomall`.
- Luồng Thi Công không mặc định `goodsType`; sau khi verify mã thành công, frontend lấy public `UnitConfig` của đúng unit để hiển thị các loại hàng đang mở và tài xế tự chọn loại hàng giao.
- Mã Thi Công được giữ nguyên chữ hoa/thường khi gửi sang API bên thứ 3 vì endpoint kiểm tra phân biệt case.
- Ngày giao được backend đặt là ngày hiện tại theo giờ Việt Nam; tài xế không chọn ngày. Cả PO và Thi Công chọn loại xe ở bước 2.
- Backend yêu cầu ngày gửi lên và `requestedTime` nếu có phải thuộc ngày hiện tại theo giờ Việt Nam, kiểm tra lại trước khi tạo đơn cho cả đăng ký nhanh và thủ công. Đăng ký nhanh còn yêu cầu token hợp lệ và ngày trong token phải là hôm nay; qua ngày cần kiểm tra lại mã. Qua ngày trong luồng thủ công cần đăng ký lại.

## Output Thành Công

`POST /api/deliveries/register` trả delivery đã tạo, gồm `registrationCode`. Frontend `SuccessScreen`:

- Hiển thị QR/mã đăng ký.
- Hiển thị Mã đối chiếu để tài xế có thể đối chiếu khi cần.
- Cho nút theo dõi.
- Khi màn thành công mở, tự cuộn về đầu trang để tài xế thấy thông báo. Nút theo dõi tự động đếm ngược 15 giây rồi điều hướng sang `/track/:code`.
- Lưu mã chuyến ngay vào danh sách gần đây và kiểm tra notification/âm báo. Nếu chưa sẵn sàng, mở Ant Modal để người dùng bấm xin quyền; bộ đếm 15 giây tạm dừng khi modal mở. Đăng ký không tự gán thông báo cá nhân: tài xế chọn **Theo dõi chuyến giao hàng này** trong Track. Sau đó provider giữ cảnh báo xuyên route; xem `track-pwa-push.md`.
