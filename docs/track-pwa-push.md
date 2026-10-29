# Theo Dõi Chuyến, Thông Báo Toàn Cục Và PWA

## Hành vi cho tài xế

1. Đăng ký thành công: lưu mã vào danh sách chuyến trên thiết bị, kiểm tra quyền và mở hướng dẫn bật thông báo/âm báo nếu chưa sẵn sàng. Bộ đếm chuyển sang Track vẫn là 15 giây, tạm dừng trong lúc modal thiết lập mở.
2. Mở `/track/:code`, kiểm tra biển số. Nút cuối trang dựa trên mã chuyến đang lưu: nếu trùng thì hiện **Dừng nhận thông báo chuyến này**, nếu khác hoặc chưa chọn thì hiện **Bật thông báo và âm báo**. Chỉ xem một chuyến không tự chuyển liên kết thông báo của thiết bị sang chuyến đó.
3. Mỗi trình duyệt/PWA theo dõi chủ động một chuyến. Bấm bật trên chuyến khác sẽ hỏi xác nhận trước khi chuyển; chuyến cũ có thể nằm trong danh sách gần đây nhưng không còn là chuyến được chọn.
4. Sau khi chọn, cảnh báo cá nhân hoạt động trên mọi route khi ứng dụng đang mở, kể cả `/waiting-screen`.
5. Hoàn tất: hiển thị thông báo hoàn thành rồi xóa lựa chọn theo dõi, mã khỏi danh sách gần đây và binding push tương ứng. Hủy/hết hạn/kết thúc chưa hoàn tất cũng ngừng theo dõi, không bị hiểu nhầm là giao thành công.

`/waiting-screen` vẫn là bảng quan sát hàng chờ. Event toàn khu vực chỉ refresh/highlight dòng xe. TV không chọn chuyến không nhận cảnh báo cá nhân; tài xế đã theo dõi chuyến vẫn nhận cảnh báo đúng chuyến khi mở bảng hàng chờ.

## Frontend

- `frontend/src/main.tsx`: một `DriverNotificationsProvider` bên trong SocketProvider, bên ngoài route/shell.
- `frontend/src/features/driver-notifications/DriverNotificationsProvider.tsx`: chủ sở hữu chuyến được chọn, room cá nhân, quyền thiết bị, push binding, overlay, âm thanh/rung.
- `model.ts`: persistence, kiểm tra mã chuyến, chống event trùng/cũ; lưu yêu cầu gỡ push đang chờ khi mất mạng.
- `FollowTripCard.tsx`: một nút chọn/dừng theo dõi theo mã chuyến đã lưu; trạng thái quyền và push không quyết định chuyến đã chọn.
- `SavedTrips.tsx`: danh sách gần đây trên `/` và `/track`; không xóa mã vì lỗi mạng tạm thời.
- `PwaInstallGuide.tsx`: hướng dẫn Android/iOS bằng Ant Modal.
- `frontend/src/features/track/hooks/useTrackContent.ts`: chỉ đọc và trình bày chuyến, QR, hàng chờ, wake lock; không sở hữu cảnh báo cá nhân.
- `frontend/src/lib/trackRoom.ts`: đếm chủ sở hữu room; rời trang chi tiết không làm provider toàn cục rời room; tự join lại sau reconnect.
- `frontend/src/lib/chime.ts`: âm báo có điểm kết thúc và hàm dừng mọi oscillator đã lên lịch.

### Trạng thái và cảnh báo

| Trạng thái | Foreground overlay | Âm báo/rung | Web Push |
| --- | --- | --- | --- |
| `WAITING` | Check-in thành công; tự đóng 10 giây | Một lượt ngắn | Có |
| `CALLED` (cả gọi lại/đổi slot) | Mời vào vị trí; giữ đến khi đóng hoặc đổi trạng thái | Âm lặp đến khi đóng cảnh báo hoặc cảnh báo bị thay thế | Có |
| `RECEIVING`, `AUTO_WAREHOUSE_RECEIVING` | Không; đóng cảnh báo gọi cũ | Dừng âm/rung cũ | Có, giữ thông báo bắt đầu nhận hàng đang có |
| `COMPLETED` | Hoàn thành; tự đóng 10 giây | Một lượt ngắn | Có; sau đó gỡ binding |
| `CANCELLED`, `EXPIRED`, `INCOMPLETED` | Không hiển thị thành công; dọn theo dõi | Dừng | Có; sau đó gỡ binding |

Đóng overlay, đổi/dừng chuyến hoặc đổi trạng thái đều dừng âm/rung. Âm gọi xe còn lặp khi overlay vẫn mở, nhưng trình duyệt/hệ điều hành có thể tạm dừng âm khi ứng dụng ở nền. Foreground chỉ xử lý sự kiện ở cửa sổ visible và focus; tab khác đồng bộ localStorage để tránh phát trùng. Reconnect/focus/visibility/push signal tải lại trạng thái hiện tại, không phát lại toàn bộ lịch sử. Gọi lại có timestamp riêng từ `RECALLED`; API Track thêm `notificationCalledAt` để phục hồi lượt gọi lại, không sửa `calledTime` vận hành.

### Dữ liệu thiết bị

- `dqm_followed_trip_v1`: mã/biển số/trạng thái, tối đa 30 event ID và thời điểm gần nhất.
- `qms_active_deliveries`: tối đa 5 mã gần đây; không phải danh sách đăng ký push.
- `dqm_pending_push_detach_v1`: mã cần gỡ khi dừng/đổi lúc mất mạng; thử lại khởi động/focus/online. Gỡ luôn kèm mã để không xóa binding chuyến mới.
- `dqm_pwa_guide_hidden`: checkbox không hiện lại, chỉ lưu khi đóng modal.
- `dqm_pwa_installed`: bằng chứng cài đặt đã quan sát, không phải khả năng kiểm kê app trên mọi OS.

Dữ liệu gắn với browser/profile/origin; browser và PWA có thể có kho riêng. Hệ thống liên kết thiết bị tự nguyện với mã chuyến, không suy danh tính tài xế từ đăng nhập. Xóa dữ liệu/đổi thiết bị có thể cần nhập mã hoặc biển số và chọn theo dõi lại.

## Backend và realtime

`sendPushToDelivery` trong `backend/src/services/webPush.ts` nhận status và thời điểm sự kiện đã commit, emit `driver_notification` vào `track:{registrationCode}` trước I/O gửi push. Socket hoạt động cả khi chưa có VAPID.

Payload: `deliveryCode/status/occurredAt/eventId/title/body`; eventId là `code:status:occurredAt`. Check-in, auto-assign, gọi thủ công/gọi lại, nhận hàng, hoàn tất, hủy và scheduler kết thúc chuyến đều gửi sự kiện. Quyền, cấp số, slot, auto-assign và lịch sử vận hành giữ nguyên.

API:

- `GET /api/track/search`, `GET /api/track/:code`: tra cứu public.
- `GET /api/push/vapid-public-key`: khóa public hoặc 503 khi chưa cấu hình.
- `POST /api/push/subscribe`: upsert endpoint theo mã còn active; kiểm tra lại sau upsert để xử lý race hoàn tất.
- `DELETE /api/push/unsubscribe`: endpoint và mã chuyến; không gỡ binding đã chuyển mã khác.

VAPID dùng `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Không đổi schema. TTL 120 giây khi gọi, 300 giây trạng thái khác; urgency high. Endpoint hết hiệu lực 404/410 được xóa. Binding terminal dọn sau lần gửi cuối, kể cả chưa có VAPID. Gửi best-effort, chưa có durable push outbox/retry xuyên backend restart.

## Service worker và giới hạn nền tảng

`frontend/public/sw.js` nhận push toàn app. Worker hỏi cửa sổ đang focus theo dõi mã nào, không suy từ URL. Nếu đúng chuyến, system notification im lặng để overlay/âm báo foreground xử lý; nếu không, OS xử lý notification và âm/rung. Worker luôn gọi `showNotification` cho push, phù hợp yêu cầu user-visible Safari. Cache receipt tối đa 30 chuyến chống push trùng/đảo thứ tự; push cũ chỉ trình bày lại thông báo mới nhất im lặng. Bấm notification mở đúng `/track/:code`.

- Quyền notification phải xin từ thao tác bấm; app tự mở modal giải thích nhưng không tự cấp/ép quyền. Sau reload, khi đã có chuyến theo dõi, lần chạm/click/bấm phím thật tiếp theo trên bất kỳ route nào sẽ thử chuẩn bị lại AudioContext; nếu chưa thành công thì có thể thử lại bằng tương tác tiếp theo. Không tự xin quyền notification trong thao tác chuẩn bị âm thanh. Rung tùy API/thiết bị, không có hộp xin quyền rung thống nhất.
- Android có nút cài khi nhận `beforeinstallprompt`; nếu không hướng dẫn menu.
- iOS/iPadOS Web Push cần Home Screen web app từ 16.4 trở lên. Safari hướng dẫn thêm Màn hình chính rồi mở app, tìm/chọn chuyến và bật thông báo.
- Hướng dẫn không hiện trong standalone, sau `appinstalled`, khi related-apps xác nhận hoặc đã chọn không hiện lại. Không thể kiểm tra tuyệt đối từ Safari một PWA đã cài trong kho khác; localStorage chỉ nhớ điều đã quan sát. Fresh `beforeinstallprompt` có thể xóa dấu cài cũ.
- Khóa màn hình/đóng app: không có React overlay/Web Audio. System notification/âm lượng/rung tùy OS, quyền, chế độ im lặng và tiết kiệm pin; không cam kết như cuộc gọi native.

Nguồn: [WebKit iOS/iPadOS](https://webkit.org/blog/13878/), [WebKit user-visible push](https://webkit.org/blog/12945/meet-web-push/), [Chrome installed related apps](https://developer.chrome.com/docs/capabilities/get-installed-related-apps), [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API).

## Kiểm tra

- `cd frontend && npm run test:driver-notifications`: đúng chuyến, chống trùng/đảo thứ tự, gọi lại, dừng oscillator, room chia sẻ, socket/push/cleanup, worker. Mock I/O, không sửa dữ liệu thật.
- Build frontend/backend, lint, strict changed-file UI audit.
- Browser smoke API/socket/thiết bị giả lập: chọn chuyến, đổi route/chuyến, reload, đóng chuông, hoàn tất; PWA và 360/768/1024/1440/1920. Không có screenshot baseline suite.
- Nghiệm thu thật: Android Chrome/PWA, iOS Safari/Home Screen foreground/background/khóa màn hình, từ chối quyền, mất mạng, hai tab, gọi lại, hoàn tất. Giả lập không chứng minh push/âm thanh nền thực tế.
