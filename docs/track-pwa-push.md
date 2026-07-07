# Theo Dõi Hành Trình, PWA, Web Push, Âm Thanh Và Rung

## Mục Tiêu

Tài xế theo dõi hành trình tại `/track/:code`. Khi có thay đổi trạng thái, trang track cập nhật realtime, hiện thông báo, phát âm thanh và rung nếu thiết bị hỗ trợ.

## Frontend

Files:

- `frontend/src/pages/Track.tsx`
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
- Overlay xanh khi `CALLED`, dừng khi user bấm đóng.

API:

- `GET /api/track/search`
- `GET /api/track/:code`
- `POST /api/track/active-session`
- `POST /api/track/:code/action`
- `GET /api/push/vapid-public-key`
- `POST /api/push/subscribe`
- `DELETE /api/push/unsubscribe`

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

## Điểm Cần Test Thật

- Android Chrome browser foreground.
- Android installed PWA background.
- iOS Safari browser foreground.
- iOS installed PWA background.
- Desktop Chrome foreground/background.
