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
- Ở step 2 của cả PO và Thi Công, mã NCC có gợi ý theo khu vực/đơn vị đã xác thực. Chọn gợi ý điền cả mã và tên; NCC không có trong danh sách vẫn có thể nhập tự do. Thông tin NCC do API bên thứ ba trả về tiếp tục được điền sẵn.
- Đăng ký (cả `/register` và `/register-manual`) không chọn khung giờ và không bị giới hạn công suất. Khung giờ giao hàng chỉ chặn lúc check-in, xem `check-in-flow.md`.
- Step 3 review đầy đủ dữ liệu đã chuẩn hóa rồi submit đăng ký. Nếu mã NCC khớp danh sách active của đơn vị đã xác thực, loại hàng hiển thị là “Kho tự động”; trong khi kiểm tra hoặc nếu không kiểm tra được, giao diện thông báo trạng thái tương ứng. Payload vẫn gửi loại hàng ban đầu và backend quyết định lại khi tạo lượt.

Wizard thủ công `/register-manual`:

1. Dùng `BusinessLocation` đã chọn qua tên khu vực trên public header; chọn đơn vị giao, loại hàng và loại xe trong wizard. Người chưa đăng nhập và `SUPERADMIN` có thể mở bộ chọn; các role đăng nhập khác chỉ xem tên. Khi đổi khu vực toàn cục, wizard quay về bước 1 và xóa các lựa chọn phụ thuộc.
2. Ngày giao hàng là ngày hiện tại theo giờ Việt Nam do backend trả; tài xế nhập tự do Mã PO / Thi Công hoặc dùng camera quét QR/Barcode hay chọn ảnh để điền mã. Không yêu cầu mã hoặc tên nhà cung cấp. Công suất của ngày hiện tại vẫn được kiểm tra.
3. Nhập thông tin tài xế và phương tiện.
4. Review và hoàn tất đăng ký.

Logic trong `useRegisterForm.ts`:

- Nhận `businessLocationId` từ `PublicBusinessLocationContext`; context chung là nơi lấy danh sách public `GET /api/units/public/business-locations` và lưu lựa chọn thiết bị.
- Theo khu vực toàn cục, lấy unit active: `GET /api/units/public/configs?businessLocationId=...`.
- Lấy cấu hình unit: `GET /api/units/:unit/config?businessLocationId=...&unitConfigId=...`.
- Lấy loại hàng tùy biến: `GET /api/units/:unit/goods-types?businessLocationId=...&unitConfigId=...`. Dữ liệu nằm trong `unit_goods_types`, scope chính theo `unitConfigId` để không lẫn giữa các `BusinessLocation`.
- Lấy vehicle availability: `GET /api/units/:unit/vehicle-availability?businessLocationId=...&unitConfigId=...`.
- Có slot vận hành thì tài xế chọn được cả `TRUCK` và `MOTORBIKE`; số vị trí và sức chứa trả về là tổng dùng chung của đơn vị, không khẳng định slot chỉ nhận loại xe đó. Khi đăng ký, loại xe là bắt buộc và không còn giá trị `OTHER`.
- Lấy ngày giao hàng: `POST /api/deliveries/manual-registration-code` trả `deliveryDate` theo ngày Việt Nam của server; mã tạo kèm không được dùng trong wizard.
- Submit: `POST /api/deliveries/register` với `businessLocationId`, `unitConfigId`, unit code snapshot và `deliveryDate`; backend kiểm tra ngày hiện tại và tự lưu `requestedTime` tại `00:00` giờ Việt Nam nếu payload không gửi giờ. Nếu client không gửi ngày, backend tự dùng ngày hiện tại.
- Các field của wizard là `Form.Item name + rules` của antd trong một `Form` dùng chung (`REGISTER_FORM_NAME`); nhóm thẻ chọn (đơn vị, loại hàng, phương tiện) và ngày giao được bọc bằng `FormFieldSlot` để dùng chung rules/trạng thái lỗi.
- Nút **Tiếp theo**/**Hoàn tất đăng ký** luôn hiển thị. Khi bấm, `antForm.validateFields()` kiểm tra các field đang hiển thị của step; field lỗi được viền đỏ và hiện dòng lỗi đỏ ngay bên dưới, trang cuộn tới field lỗi nằm cao nhất (input text được focus).
- State `form` trong `useRegisterForm` vẫn là nguồn dữ liệu chính cho các effect gọi API: giá trị người dùng nhập đi vào state qua `onValuesChange`; thay đổi lập trình (chọn thẻ, quét mã, reset, dữ liệu API) được đẩy ngược vào antd form và xóa lỗi của field đó.
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
- `GET /api/units/order-codes`
- `GET /api/aw-vendors/check`
- `GET /api/aw-vendors/suggestions`

Module backend:

- `backend/src/routes/deliveries.ts`: controller mỏng cho endpoint đăng ký và lifecycle delivery.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: validate payload đăng ký, check-in lookup, call/cancel và query list.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery, queue, resolve `UnitConfig`, duplicate theo ngày giao và auto-warehouse vendor.
- `backend/src/modules/deliveries/deliveryService.ts`: tạo lượt đăng ký mới, thay thế lượt `REGISTERED` cũ cùng biển số/khu vực/ngày giao/mã PO hoặc Thi Công; Sunday fresh-food-only, history event, lịch sử đăng ký và response.
- `backend/src/domain/vehiclePlate.ts`: chuẩn hóa và kiểm tra định dạng biển số theo loại xe; bản sao phía frontend tại `frontend/src/lib/vehiclePlate.ts`.
- `backend/src/domain/driverPhone.ts`: chuẩn hóa (`+84` → `0`) và kiểm tra số điện thoại 10 số; bản sao phía frontend tại `frontend/src/lib/driverPhone.ts`.
- `backend/src/modules/registrationHistory/*`: ghi `registration_history`, đánh dấu lượt bị thay thế, nhận diện thiết bị đăng ký và truy vấn cho trang Histories.
- `backend/src/modules/deliveries/quickRegistrationService.ts`: đọc API Config, gọi API PO/Thi Công bên thứ 3, log response thật, chuẩn hóa location/unit/goods/date và phát token xác thực ngắn hạn cho submit cuối.
- `backend/src/routes/units.ts`: controller mỏng cho unit config, goods type, vehicle availability và slot availability public.
- `backend/src/modules/units/unitFormRequest.ts`: validate params/query/body của unit API.
- `backend/src/modules/units/unitRepository.ts`: query cấu hình unit, khung giờ, slot vận hành và booking active.
- `backend/src/modules/units/unitService.ts`: rule nhận loại hàng, loại xe khả dụng theo slot active, CRUD khung giờ và strip secret khỏi public config.
- `backend/src/modules/units/orderCodeMock.ts`: danh sách mock 20 mã PO và 20 mã Thi Công trong lúc API thật chưa có.

Hàm quan trọng trong module:

- `normalizeVehiclePlate()` trong `deliveryRepository.ts`.
- `normalizeDriverPhone()` và `normalizeOrderCode()` trong `deliveryRepository.ts`.
- `findDuplicateRegistration()` trong `deliveryRepository.ts`.
- `isSundayDeliveryDate()` trong `deliveryService.ts`.
- `getDailyRegistrationStats()`, `getAvailableSlots()` legacy/public và `getVehicleAvailability()` trong `modules/units/unitService.ts`.

Service:

- `backend/src/services/registrationSequence.ts`
  - `reserveRegistrationCode()` cấp registration code atomic theo ngày VN và `UnitConfig`.

## Rule Nghiệp Vụ

- Biển số xe được normalize uppercase, bỏ khoảng trắng và dấu `-`, `.`; người dùng nhập chữ thường vẫn được tự chuyển chữ hoa.
- Biển số phải đúng định dạng theo loại xe đã chọn (frontend báo lỗi đỏ dưới ô nhập, backend kiểm tra lại và trả `InvalidVehiclePlate`):
  - Xe tải: 2 số + 1 chữ + 4 hoặc 5 số. Ví dụ `51G55673`, `51G4938`.
  - Xe máy: 2 số + (1 chữ 1 số hoặc 2 chữ) + 4 hoặc 5 số. Ví dụ `59D255488`, `63AA24593`.
  - Hai định dạng có vùng giao nhau: `51G55673` vừa là biển xe tải 5 số vừa là biển xe máy cũ 4 số `51-G5 5673`, nên quy tắc chỉ chặn được biển sai cấu trúc chứ không phân biệt loại xe từ biển số.
- Số điện thoại bắt buộc đúng 10 số, bắt đầu bằng `0` (frontend báo lỗi đỏ dưới ô nhập, backend kiểm tra lại và trả `InvalidDriverPhone`). Khoảng trắng, dấu `.`, `-`, `()` được bỏ; đầu số `+84`, `0084` hoặc `84` (khi đủ 11 số) được đổi thành `0`, kể cả dạng `+84 0857…`. Ví dụ `+84857382937` lưu thành `0857382937`. Quy tắc nằm ở `backend/src/domain/driverPhone.ts` và bản sao `frontend/src/lib/driverPhone.ts`.
- Luồng thủ công `/register-manual` lưu mã người dùng nhập hoặc quét vào `poNumber`, không ràng buộc định dạng hay xác thực API đối tác. Payload gửi `manualRegistration: true`; backend vẫn áp dụng các quy tắc ngày và phạm vi.
- Mã PO / Thi Công được hiển thị ở step review, màn hình thành công và trang track.
- Luồng đăng ký nhanh cho phép mã thật ngoài danh sách mock nếu payload submit có `quickVerificationToken` hợp lệ do `POST /api/deliveries/quick-verify` phát hành.
- `registrationCode` có format `BUSINESSLOCATIONCODE + 4 ký tự cuối của UnitConfig.id + YYMMDD + số thứ tự ba chữ số`. Số thứ tự reset theo ngày và `UnitConfig`; mã location và suffix UnitConfig giữ mã đăng ký unique toàn cục để `/track/:code` và check-in không cần thêm scope.
- `BusinessLocation` public là phạm vi chung của các route public, không phải field trong wizard `/register-manual`; frontend không hardcode danh sách unit. Unit hiển thị từ `unit_configs` active của khu vực được chọn toàn cục.
- Submit register phải có `unitConfigId`. Backend validate `unitConfigId` active, thuộc `businessLocationId` đã chọn và có unit code trùng `receivingUnit`.
- Mỗi lần đăng ký thành công luôn tạo một dòng `REGISTERED` mới với **registration code/QR mới**, đồng thời ghi một dòng vào `registration_history`.
- Trong cùng BusinessLocation và ngày giao Việt Nam, một biển số chỉ có một lượt vận hành. Khi đăng ký lại cùng biển số mà lượt cũ còn `REGISTERED` chưa check-in:
  - Cùng mã PO/Thi Công (so sánh sau `normalizeOrderCode`): lượt cũ bị thay thế. Dòng lịch sử của lượt cũ được đánh dấu `supersededAt`/`supersededByCode`; event `REGISTERED` và push subscription của mã cũ bị xóa; dòng cũ bị xóa khỏi `delivery_registrations`. Số điện thoại, tên tài xế, đơn vị, loại xe/hàng có thể khác.
  - Khác mã PO/Thi Công: trả `409 VehiclePlateExists` với thông báo `Biển số xe đã tồn tại!` (frontend hiện Toast) và không chạm lượt hiện có. Đây có thể là hai xe trùng biển thật hoặc một người nhập sai biển số; tài xế liên hệ vận hành để được hướng dẫn ghi chú biển số thực tế.
- Một biển số có thể có lượt riêng tại các BusinessLocation khác nhau. Nếu lượt cùng khu vực đã check-in hoặc mang trạng thái khác `REGISTERED`, `COMPLETED`, `CANCELLED`, đăng ký bị chặn; chỉ `COMPLETED` hoặc `CANCELLED` cho phép tạo lượt mới trong cùng ngày, và lượt đã kết thúc đó không bị đánh dấu thay thế. Lượt `EXPIRED`/`INCOMPLETED` đã archive trong cùng ngày giao cũng được kiểm tra trong history; qua ngày khác thì đăng ký lại bình thường.
- Lượt `WAITING`/`CALLED` còn sót từ ngày trước do vận hành tự xử lý; quy tắc trùng chỉ xét trong ngày giao hiện tại.
- Trường hợp dữ liệu cũ có nhiều lượt chưa kết thúc cùng biển số/khu vực/ngày, API trả lỗi yêu cầu nhân viên xử lý thay vì tự chọn hoặc xóa dữ liệu. Giao dịch đăng ký khóa theo khu vực, ngày và biển số, rồi khóa dòng trước khi cập nhật để đồng bộ với check-in.
- Tra cứu check-in theo biển số lọc theo khu vực của nhân viên; trang track gửi khu vực public đang chọn khi tra cứu biển số. Nếu chưa chọn khu vực và có lượt tại nhiều khu vực, tra cứu yêu cầu chọn khu vực thay vì tự chọn một chuyến. Một đăng ký thay thế phát `queue_updated` cho đơn vị cũ và mới. Mã cũ không còn dòng vận hành: `/api/track/:code` trả 404 kèm `code: RegistrationSuperseded` (không tiết lộ mã mới), `/check-in-lookup` bằng mã cũ trả `409 RegistrationSuperseded` kèm mã hiện hành và số lần đăng ký trong ngày cho nhân viên.
- Nếu unit bật `sundayFreshFoodOnly`, ngày Chủ nhật chỉ cho `FRESH_FOOD`.
- `UnitGoodsType`, `DeliveryTimeWindow` và `AutoWarehouseVendor` có `unitConfigId` là scope chính; cột `unit` là code snapshot/compat cho API theo `:unit`.
- Nếu unit có custom goods type enabled, frontend hiển thị danh mục custom đó; khi check-in, nếu không có khung giờ riêng cho custom type thì backend fallback về khung giờ của base goods type cùng unit.

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

- `WERKS` được đối chiếu với nhóm mã trong `codeofconduct_location.json`, rồi đối chiếu nhóm với `BusinessLocation.code` đang active. `site_location_map`/`siteLocationMap` cũ vẫn được hỗ trợ nhưng nếu mã nguồn đã có nhóm thì mã đích phải thuộc cùng nhóm; nếu không thì báo xung đột cấu hình.
- Unit PO hiện match biến cấu hình nội bộ `EMART` với `unit_configs.unit` sau khi normalize để dễ mở rộng unit khác về sau.
- `EINDT` dạng `yyyyMMdd` được đổi thành `deliveryDate` và phải trùng ngày hiện tại theo giờ Việt Nam; nếu không, mã không được xác thực thành công.
- Backend lấy dòng đầu tiên trong `ITEMS`; `LIFNR` điền `vendorCode`, `VENDORNA` điền `vendorName` nếu có.
- `FRESH` từ SAP là string `"true"`/`"false"` nên backend normalize hoa/thường rồi đổi sang boolean: `true` thành `FRESH_FOOD`, `false` thành `GENERAL_GOODS`.
- Nếu response PO HTTP 200 nhưng không có dòng đầu tiên trong `ITEMS`, backend trả lỗi cấu trúc dữ liệu để tránh đăng ký sai khu vực/ngày.

Thi Công normalization:

- `data.scope.location` và `business_locations.code` được đối chiếu theo cùng nhóm mã trong `codeofconduct_location.json`.
- `data.scope.unit` fuzzy match trong `unit_configs.unit` của location, hỗ trợ các biến thể `thisky`, `thiskyhall`, `mall`, `thiso mall`, `thisomall`.
- Luồng Thi Công không mặc định `goodsType`; sau khi verify mã thành công, frontend lấy public `UnitConfig` của đúng unit để hiển thị các loại hàng đang mở và tài xế tự chọn loại hàng giao.
- Mã Thi Công được giữ nguyên chữ hoa/thường khi gửi sang API bên thứ 3 vì endpoint kiểm tra phân biệt case.
- `data.goodsMovement.approvedStartDate` và `approvedEndDate` phải là ngày hợp lệ, và ngày hiện tại theo giờ Việt Nam phải nằm trong khoảng này (bao gồm cả hai đầu). Thiếu ngày hoặc ngoài khoảng thì không xác thực; `approvedStartTime` và `approvedEndTime` không được dùng để hạn chế đăng ký.
- Ngày giao được backend đặt là ngày hiện tại theo giờ Việt Nam; tài xế không chọn ngày. Cả PO và Thi Công chọn loại xe ở bước 2.
- Backend yêu cầu ngày gửi lên và `requestedTime` nếu có phải thuộc ngày hiện tại theo giờ Việt Nam, kiểm tra lại trước khi tạo đơn cho cả đăng ký nhanh và thủ công. Đăng ký nhanh còn yêu cầu token hợp lệ và ngày trong token phải là hôm nay; qua ngày cần kiểm tra lại mã. Qua ngày trong luồng thủ công cần đăng ký lại.

## Output Thành Công

`POST /api/deliveries/register` trả delivery đã tạo, gồm `registrationCode`. Frontend `SuccessScreen`:

- Hiển thị QR/mã đăng ký.
- Hiển thị Mã đối chiếu để tài xế có thể đối chiếu khi cần.
- Cho nút theo dõi.
- Khi màn thành công mở, tự cuộn về đầu trang để tài xế thấy thông báo. Nút theo dõi tự động đếm ngược 15 giây rồi điều hướng sang `/track/:code`.
- Lưu mã chuyến vào danh sách gần đây. Tài xế bấm **Nhận thông báo cho chuyến này** ngay trên màn thành công hoặc tại Track để chọn chuyến và bắt đầu thiết lập quyền; đăng ký không tự chọn chuyến. Bộ đếm 15 giây tạm dừng khi xử lý hoặc mở modal xác nhận/thiết lập. Provider giữ cảnh báo xuyên route; xem `track-pwa-push.md`.
