# Theo Dõi Hành Trình, PWA, Web Push, Âm Thanh Và Rung

## Mục Tiêu

Tài xế theo dõi hành trình tại `/track/:code`. Khi có thay đổi trạng thái trong lúc trang Track đang mở, route này cập nhật realtime, hiện Ant `StatusAlertOverlay`, phát âm thanh và rung nếu thiết bị hỗ trợ. Đây chưa phải là cơ chế global cho mọi public route.

## Frontend

Files:

- `frontend/src/pages/Track.tsx`: route wrapper.
- `frontend/src/features/track/Track.tsx`: implementation.
- `frontend/src/lib/pwa.ts`
- `frontend/src/lib/platform.ts`
- `frontend/src/lib/chime.ts`
- `frontend/src/lib/session.ts`
- `frontend/public/sw.js`

Chức năng:

- Tìm delivery bằng mã hoặc biển số.
- Lưu active tracking session trong localStorage.
- Join socket room `track:{registrationCode}`.
- Subscribe web push.
- Wake lock nếu trình duyệt hỗ trợ.
- Audio/vibration khi được gọi vào slot.
- Ant `StatusAlertOverlay`: `CALLED` là urgent và chỉ dừng khi người dùng đóng; `WAITING` và `COMPLETED` tự đóng sau 10 giây.
- Chime `CALLED` dùng AudioContext đã được mở bằng thao tác người dùng; đóng overlay, rời route hoặc rời trạng thái `CALLED` sẽ dừng cả interval lẫn các oscillator đang phát.
- Unit label/color/ticket prefix trên track dùng metadata `unitConfig` từ API khi có; nếu delivery legacy thiếu metadata thì fallback generic theo mã unit.

API:

- `GET /api/track/search`
- `GET /api/track/:code`
- `POST /api/track/active-session`
- `GET /api/push/vapid-public-key`
- `POST /api/push/subscribe`
- `DELETE /api/push/unsubscribe`

Track hiện là bề mặt public read/notification cho tài xế. Route staff PIN/action cũ đã bị gỡ; các thao tác check-in/receiving/cancel đi qua tài khoản nội bộ và `/api/deliveries/*`.

### Phạm vi hiện tại và giới hạn

- Service worker được register toàn app, nhưng việc xin permission, tạo PushSubscription, join `track:{registrationCode}`, xử lý foreground transition và mở overlay đều nằm trong `useTrackContent(code)`. Vì vậy chỉ `/track/:code` đang chạy mới có foreground overlay/audio và tự subscribe push.
- `WAITING` (check-in) hiện chỉ emit realtime track update; backend chưa gửi Web Push cho trạng thái này. `CALLED`, bắt đầu nhận hàng, hoàn tất và hủy đã có lệnh gửi Web Push nếu delivery có subscription và VAPID được cấu hình. UI Track hiện chỉ tạo overlay cho `WAITING`, `CALLED` và `COMPLETED`.
- `/waiting-screen` không thuộc cơ chế cảnh báo tài xế: đó là màn hình chờ/TV read-only, chỉ refresh queue và highlight xe vừa được gọi.
- Push background chỉ hiển thị system notification qua Service Worker; âm thanh và cách hiển thị do hệ điều hành/trình duyệt/quyền người dùng quyết định. React overlay và Web Audio không thể chạy khi ứng dụng đã đóng.

## Backend

Files:

- `backend/src/routes/track.ts`
- `backend/src/routes/push.ts`
- `backend/src/services/webPush.ts`
- `backend/src/services/trackRealtime.ts`

Service:

- `initWebPush()`
- `sendPushToDelivery(deliveryCode, payload)`
- `getTrackDelivery(registrationCode)`
- `emitTrackUpdated(registrationCode)`
- `emitTrackUpdatesForQueue(queue)`

## Platform/PWA

`platform.ts`:

- Detect iOS/Android/desktop.
- Detect standalone PWA.
- Kiểm tra push support.

`pwa.ts`:

- Register service worker `/sw.js`.
- Convert VAPID public key.
- Setup PWA registration.

Service worker:

- Nhận event `push`.
- Nếu app/track đang focus thì có thể im lặng để React foreground xử lý.
- Nếu app ẩn/tắt thì show notification.

## Lưu Ý Về iOS

- iOS Web Push yêu cầu iOS 16.4+ và web app được Add to Home Screen.
- Vibration API trên iOS bị hạn chế; không nên coi rung là đảm bảo tuyệt đối.
- Audio autoplay cần có user gesture trước đó.
- Permission notification phải được yêu cầu từ một thao tác trực tiếp của người dùng; không tự động xin permission khi mount route.

## Điểm Cần Test Thật

- Android Chrome browser foreground.
- Android installed PWA background.
- iOS Safari browser foreground.
- iOS installed PWA background.
- Desktop Chrome foreground/background.
