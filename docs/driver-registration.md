# Luồng Tài Xế Đăng Ký Giao Hàng

## Mục Tiêu

Tài xế/NCC có hai điểm vào public, không cần đăng nhập:

- `/`: trang chủ mặc định của domain, hiện là luồng đăng ký nhanh bằng mã PO/Thi Công và API Config.
- `/register`: luồng đăng ký thủ công hiện có, giữ nguyên để dùng khi nhập từ bản giấy hoặc khi hệ thống/API online gặp sự cố.

Sau khi đăng ký thành công qua luồng thủ công hiện tại, tài xế nhận:

- `registrationCode`
- QR code/tracking code
- Nút theo dõi hành trình tự động đếm ngược và chuyển sang `/track/:code`

## Frontend

Files:

- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/features/register/hooks/useRegisterForm.ts`
- `frontend/src/features/register/api.ts`
- `frontend/src/features/register/types.ts`
- `frontend/src/features/register/constants.ts`
- `frontend/src/features/register/steps/UnitGoodsVehicleStep.tsx`
- `frontend/src/features/register/steps/ScheduleStep.tsx`
- `frontend/src/features/register/steps/DriverInfoStep.tsx`
- `frontend/src/features/register/steps/ReviewSubmitStep.tsx`
- `frontend/src/features/register/components/SuccessScreen.tsx`
- `frontend/src/features/register/components/FieldFrame.tsx`
- `frontend/src/features/register/components/FieldFeedback.tsx`
- `frontend/src/features/register/components/DeliveryDateCalendar.tsx`

Routes:

- `/` render `Home.tsx`. Đây không còn redirect sang `/register`.
- `/register` render `Register.tsx` và giữ wizard thủ công cũ.
- `/taixe` hiện vẫn redirect sang `/register`.

Homepage `/` hiện có:

- Lời chào `Hệ thống điều phối giao hàng THISO`.
- Ô nhập mã PO/Thi Công.
- Nút camera dạng SVG nét vẽ trong input. Hiện nút này mới là khung UI, chưa bật camera thật.
- Validate format cơ bản phía client:
  - PO: 10 chữ số, bắt đầu bằng `450`, không có khoảng trắng.
  - Thi Công: đúng 5 ký tự có cả chữ và số, không có khoảng trắng.
- Step 1 gọi `POST /api/deliveries/quick-verify` để backend kiểm tra mã bằng API bên thứ 3 theo cấu hình trong `app_configs`.
- Step 2 PO nhập thông tin tài xế/xe/NCC, ngày giao lấy từ API PO; chỉ số điện thoại và biển số xe là bắt buộc.
- Step 2 Thi Công nhập thông tin tài xế/xe/NCC và chọn ngày giao bằng calendar tháng hiện tại; chỉ số điện thoại và biển số xe là bắt buộc.
- Step 3 review đầy đủ dữ liệu đã chuẩn hóa rồi submit đăng ký.
- Link sang `/register` cho đăng ký thủ công/bản giấy.
- Link sang `/track` để theo dõi đơn.

Wizard thủ công `/register`:

1. Chọn `BusinessLocation`, đơn vị nhận hàng, loại hàng, loại xe.
2. Chọn ngày giao hàng bằng calendar tháng hiện tại, xem mật độ đăng ký theo ngày, nhập thông tin nhà cung cấp/PO.
3. Nhập thông tin tài xế/xe/nhà cung cấp.
4. Review và hoàn tất đăng ký.

Logic trong `useRegisterForm.ts`:

- Lấy danh sách khu vực public: `GET /api/units/public/business-locations`.
- Sau khi chọn khu vực, lấy unit active: `GET /api/units/public/configs?businessLocationId=...`.
- Lấy cấu hình unit: `GET /api/units/:unit/config?businessLocationId=...&unitConfigId=...`.
- Lấy loại hàng tùy biến: `GET /api/units/:unit/goods-types?businessLocationId=...&unitConfigId=...`. Dữ liệu nằm trong `unit_goods_types`, scope chính theo `unitConfigId` để không lẫn giữa các `BusinessLocation`.
- Lấy vehicle availability: `GET /api/units/:unit/vehicle-availability?businessLocationId=...&unitConfigId=...`.
- Lấy thống kê mật độ đăng ký theo ngày: `GET /api/units/:unit/daily-registration-stats?month=YYYY-MM&goodsType=...&vehicleType=...&businessLocationId=...&unitConfigId=...`.
- Check vendor kho tự động: `GET /api/aw-vendors/check?code=...&unit=...&businessLocationId=...&unitConfigId=...`.
- Submit: `POST /api/deliveries/register` với `businessLocationId`, `unitConfigId`, unit code snapshot và `deliveryDate`; backend tự lưu `requestedTime` tại `00:00` của ngày giao theo giờ Việt Nam nếu payload không gửi giờ.
- Scroll tới field lỗi đầu tiên khi validate fail.
- Khi sửa từ step review, bấm tiếp theo quay lại step 4.

Lưu ý: các logic trong `frontend/src/features/register/*` hiện thuộc luồng thủ công `/register`. Luồng online mới trên `/` không nên sửa trực tiếp các step này nếu mục tiêu là giữ `/register` ổn định cho đăng ký bản giấy.

## Backend

API chính:

- `POST /api/deliveries/register`
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
- `POST /api/deliveries/public-cancel`

Module backend:

- `backend/src/routes/deliveries.ts`: controller mỏng cho endpoint đăng ký và lifecycle delivery.
- `backend/src/modules/deliveries/deliveryFormRequest.ts`: validate payload đăng ký, public cancel, check-in lookup, call/cancel và query list.
- `backend/src/modules/deliveries/deliveryRepository.ts`: query delivery, queue, resolve `UnitConfig`, capacity ước lượng theo ngày, duplicate theo ngày giao và auto-warehouse vendor.
- `backend/src/modules/deliveries/deliveryService.ts`: rule đăng ký, duplicate theo `vehiclePlate + driverPhone + poNumber` trong ngày giao, public cancel, capacity lock theo ngày, Sunday fresh-food-only, history event và response.
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
- `findDeliveryForPublicCancel()` trong `deliveryRepository.ts`.
- `ensureRegistrationDailyCapacity()` trong `deliveryService.ts`.
- `isSundayDeliveryDate()` trong `deliveryService.ts`.
- `getDailyRegistrationStats()`, `getAvailableSlots()` legacy/public và `getVehicleAvailability()` trong `modules/units/unitService.ts`.

Service:

- `backend/src/services/registrationSequence.ts`
  - `reserveRegistrationCode()` cấp registration code atomic theo ngày VN và receiving unit.

## Rule Nghiệp Vụ

- Biển số xe được normalize uppercase và bỏ khoảng trắng.
- Số điện thoại duplicate được normalize chỉ còn chữ số.
- Số PO/Mã thi công khi lưu/so sánh trong đăng ký được normalize uppercase và bỏ ký tự phân cách; riêng bước quick verify mã Thi Công giữ nguyên hoa/thường khi gọi API bên thứ 3.
- Luồng thủ công vẫn dùng `GET /api/units/order-codes` trả mock 20 mã `PO##########` và 20 mã `TC##########`; backend register vẫn validate lại mã này.
- Luồng đăng ký nhanh cho phép mã thật ngoài danh sách mock nếu payload submit có `quickVerificationToken` hợp lệ do `POST /api/deliveries/quick-verify` phát hành.
- `BusinessLocation` public là bước đầu của luồng thủ công `/register`; frontend không hardcode danh sách unit. Unit hiển thị từ `unit_configs` active của khu vực được chọn.
- Submit register phải có `unitConfigId`. Backend validate `unitConfigId` active, thuộc `businessLocationId` đã chọn và có unit code trùng `receivingUnit`.
- Duplicate registration chỉ bị chặn khi cùng ngày giao đã chọn có lượt active trùng đủ cả ba thông tin `vehiclePlate + driverPhone + poNumber` trong cùng `unitConfigId`.
- Cùng biển số vẫn được đăng ký ngày khác, hoặc cùng ngày nhưng khác số điện thoại/PO/TC.
- Tài xế chỉ có thể tự hủy chuyến tại `/cancelled` trước khi check-in, tức delivery còn `REGISTERED`; endpoint public đối chiếu đúng 5 trường `vehiclePlate`, `driverPhone`, `poNumber`, `registrationCode`, `deliveryDate` theo ngày giao, sau đó archive lịch sử với lý do `Tài xế thao tác hủy` và xóa row operational. Endpoint vẫn nhận `requestedTime` từ client cũ và quy đổi về ngày giao để tương thích.
- Nếu unit bật `sundayFreshFoodOnly`, ngày Chủ nhật chỉ cho `FRESH_FOOD`.
- Backend validate lại capacity ước lượng theo ngày khi submit để tránh frontend bị stale.
- Capacity ngày tính theo:
  - `unitConfigId`
  - unit code snapshot
  - vehicleType
  - deliveryDate
  - active statuses: `REGISTERED`, `WAITING`, `CALLED`, `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING`
- Capacity ngày lấy từ `DeliveryTimeWindow` enabled cộng với `truckSlotMinutes`/`motorbikeSlotMinutes` và `truckMaxPerSlot`/`motorbikeMaxPerSlot`. `DeliveryTimeWindow` không còn sinh các ô giờ cho `/register`; nó chỉ còn phục vụ ước lượng công suất ngày và đo lường vận hành.
- Capacity không tách theo `goodsType` khi đếm lượt đã đăng ký; `goodsType` dùng để chọn đúng nhóm time window ước lượng và rule eligibility.
- `UnitGoodsType`, `DeliveryTimeWindow` và `AutoWarehouseVendor` có `unitConfigId` là scope chính; cột `unit` là code snapshot/compat cho API theo `:unit`.
- Nếu unit có custom goods type enabled, frontend hiển thị danh mục custom đó; nếu không có time window riêng cho custom type thì backend/frontend fallback về time window base goods type của cùng unit.

## Luồng Online Trên `/`

Endpoint verify:

- `POST /api/deliveries/quick-verify`
- Body: `{ "code": "..." }`
- Backend tự phân loại mã:
  - `PO` nếu mã có đúng 10 chữ số và bắt đầu bằng `450`.
  - `Thi Công` nếu mã có đúng 5 ký tự có cả chữ và số.
- Backend đọc config theo key cố định:
  - PO: `api.settings.po_verify`.
  - Thi Công: `api.settings.thi_cong_verify`.
- Config không được hardcode endpoint hoặc credential trong source. Giá trị request cố định nên nằm trong `payload`, `payload_defaults` hoặc `payloadDefaults` của `app_configs`, riêng PO hiện backend luôn ép `BUKRS = VN01` và `EBELN = <mã PO tài xế nhập>`.
- Auth lấy từ `value.auth.header` trong `app_configs`.
- Backend log response thật của API bên thứ 3 để đối chiếu trong giai đoạn tích hợp.
- Backend không trả raw response của bên thứ 3 xuống frontend; frontend chỉ nhận dữ liệu đã chuẩn hóa.

PO normalization:

- `WERKS` map sang `BusinessLocation.code`: `1001 -> PVT`, `1002 -> SALA`, `1003 -> PHI`, `2001 -> THT`.
- Unit PO hiện match biến cấu hình nội bộ `EMART` với `unit_configs.unit` sau khi normalize để dễ mở rộng unit khác về sau.
- `EINDT` dạng `yyyyMMdd` được đổi thành `deliveryDate`.
- Backend lấy dòng đầu tiên trong `ITEMS`; `LIFNR` điền `vendorCode`, `VENDORNA` điền `vendorName` nếu có.
- `FRESH` từ SAP là string `"true"`/`"false"` nên backend normalize hoa/thường rồi đổi sang boolean: `true` thành `FRESH_FOOD`, `false` thành `GENERAL_GOODS`.
- Nếu response PO HTTP 200 nhưng không có dòng đầu tiên trong `ITEMS`, backend trả lỗi cấu trúc dữ liệu để tránh đăng ký sai khu vực/ngày.

Thi Công normalization:

- `data.scope.location` match `business_locations.code`.
- `data.scope.unit` fuzzy match trong `unit_configs.unit` của location, hỗ trợ các biến thể `thisky`, `thiskyhall`, `mall`, `thiso mall`, `thisomall`.
- Luồng Thi Công không mặc định `goodsType`; sau khi verify mã thành công, frontend lấy public `UnitConfig` của đúng unit để hiển thị các loại hàng đang mở và tài xế tự chọn loại hàng giao.
- Mã Thi Công được giữ nguyên chữ hoa/thường khi gửi sang API bên thứ 3 vì endpoint kiểm tra phân biệt case.
- Ngày giao do tài xế chọn ở step 2 vì response Thi Công không cố định một ngày giao duy nhất.

## Output Thành Công

`POST /api/deliveries/register` trả delivery đã tạo, gồm `registrationCode`. Frontend `SuccessScreen`:

- Hiển thị QR/mã đăng ký.
- Cho nút theo dõi.
- Tự động đếm ngược 10 giây và điều hướng sang `/track/:code`.
