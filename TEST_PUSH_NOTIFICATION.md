# Push Notification - Test & Validation Guide

## Overview
Sau các fix trong Nhiệm vụ 3, hệ thống push notification nên hoạt động ở tất cả 4 trạng thái chuyển đổi:
1. ✅ Gọi xe (auto-assign) - **đã hoạt động**
2. ✅ Gọi lại (manual call) - **vừa fix**
3. ✅ Bắt đầu nhận hàng (start receiving) - **vừa fix**  
4. ✅ Hoàn tất giao hàng (complete) - **đã hoạt động**

---

## Test Environment Setup

### Prerequisites
```bash
# 1. Backend đang chạy
cd backend && npm run dev

# 2. Frontend đang chạy
cd frontend && npm run dev  

# 3. Android device hoặc Chrome DevTools Emulation
# - hoặc: Real Android phone với Chrome/Firefox/Samsung Internet
# - hoặc: Chrome Desktop với DevTools (Shift+Ctrl+I)
```

### Enable Logging
Tất cả console logs đã được thêm để track push events:
- Backend: `[WebPush]` prefix
- Frontend: `[PWA]`, `[Track]`, `[Push]`, `[SW]` prefix
- Service Worker: `[SW Push]`, `[SW NotificationClick]` prefix

---

## Test Scenarios

### Scenario 1: App MỞ - Tất cả hành động phải có âm thanh + rung + notification

#### 1.1 Auto-assign gọi xe
**Setup:**
1. Tài xế vào `/track/:code` 
2. Bấm "Bật thông báo" khi xuất hiện prompt
3. Dashboard có 1 slot với auto-assign enable
4. Tài xế vừa check-in (WAITING status)

**Action:**
- Dashboard trigger auto-assign → delivery chuyển sang CALLED
- Hoặc: Auto-assign tự động chạy sau khi check-in

**Expected:**
- ✅ Tài xế nghe thấy **âm thanh beep** (beep-beep dài)
- ✅ Tài xế cảm nhận **rung điện thoại** 
- ✅ Notification hiển thị: `"🚛 Mời vào {slot.code}"` + `"Xe {plate} — {slot.name}. Vui lòng vào ngay!"`
- ✅ Browser console: `[WebPush] ✓ Sent to...`
- ✅ Service Worker console: `[SW Push] Showing notification` + vibrate pattern

**Debug if fails:**
```
1. Check: /api/push/subscribe endpoint lưu subscription chưa?
   - Backend log: [Push] Subscription saved: {...}
2. Check: deliveryCode chính xác không?
   - Confirm: deliveryCode === registrationCode (E/T/M + date + seq)
3. Check: Notification permission granted?
   - Frontend: notifPermission === 'granted'
4. Service Worker active?
   - Chrome DevTools → Application → Service Workers
```

---

#### 1.2 Manual call từ Dashboard
**Setup:**
1. Tài xế ở `/track/:code` với push enabled (WAITING)
2. Dashboard: có delivery đang WAITING, bấm button "Gọi vào {slot}"

**Action:**
- Click "Gọi vào {slot}" button → `PATCH /api/deliveries/:id/call`

**Expected:**
- ✅ Tài xế nghe **âm thanh call** 
- ✅ Tài xế cảm nhận **rung**
- ✅ Notification: `"🚛 Mời vào {slot.code}"` + `"Xe {plate} — {slot.name}. Vui lòng vào ngay!"`
- ✅ Backend log: `[WebPush] Sending push to X subscription(s)`
- ✅ Status alert hiển thị: `"🚛 Được gọi vào {slot.code}!"`

**Debug if fails:**
```
1. Backend log: có "[WebPush] Sending push" không?
   - Nếu không → endpoint `/api/deliveries/:id/call` chưa gọi sendPushToDelivery
2. Subscription tồn tại không?
   - Backend log: "No subscriptions found for delivery: {code}"
3. Push send thành công không?
   - Log: "[WebPush] ✓ Sent" vs "[WebPush] Send failed"
```

---

#### 1.3 Start Receiving từ Dashboard
**Setup:**
1. Tài xế `/track/:code` với push enabled (CALLED)
2. Dashboard: Tài xế đó được gọi vào slot, bấm "Xác nhận bắt đầu nhận hàng"

**Action:**
- Click "Bắt đầu nhận hàng" → `PATCH /api/deliveries/:id/start-receiving`

**Expected:**
- ✅ Tài xế nghe **âm thanh beep** (ngắn)
- ✅ Tài xế cảm nhận **rung**
- ✅ Notification: `"📦 Bắt đầu giao hàng"` + `"Xe {plate} tại {slot.name}"`
- ✅ Status change: `CALLED` → `RECEIVING` / `AUTO_WAREHOUSE_RECEIVING`

---

#### 1.4 Complete từ Dashboard
**Setup:**
1. Tài xế `/track/:code` (RECEIVING)
2. Dashboard: bấm "Hoàn tất giao hàng"

**Action:**
- Click "Hoàn tất" button → `PATCH /api/deliveries/:id/complete`

**Expected:**
- ✅ Tài xế nghe **âm thanh celebrate** (beep-beep-beep nhanh)
- ✅ Tài xế cảm nhận **rung pattern** (200, 100, 400)
- ✅ Notification: `"🎉 Giao hàng hoàn tất"` + `"Xe {plate} — Cảm ơn bạn đã giao hàng!"`
- ✅ Alert: `"✅ Giao hàng hoàn thành!"`

---

### Scenario 2: App ĐÓNG - Notification phải hiển thị + rung (OS default)

**Setup:**
1. Tài xế vào `/track/:code`, bấm enable push
2. **Đóng hoàn toàn app** (không phải chỉ minimize)
3. **Đóng Chrome browser hoặc tab** (nếu desktop)

**Action:**
- Từ Dashboard: Click "Gọi vào slot" trên delivery của tài xế đó

**Expected:**
- ✅ Notification hiển thị trên **lock screen** (không phải in-app alert)
- ✅ Cảm nhận **rung điện thoại** (OS vibration, mặc định)
- ✅ Có âm thanh (nếu điện thoại không bật silent mode)
- ⚠️ **Không có audio beep** từ Web Audio API (vì app đóng)

**Debug if fails:**
```
1. Service Worker vẫn active?
   - Chrome/Edge: DevTools → Application → Service Workers
   - Firefox: about:debugging → Service Workers
2. Push subscription có còn hợp lệ không?
   - Thử unsubscribe + resubscribe
3. Notification permission có bị reset không?
   - Settings → Notification → check quyền cho app/browser
```

---

### Scenario 3: Kiosk (Terminal) - Check xem có double notifications không

**Setup:**
1. Tài xế đã check-in → WAITING
2. Bảo vệ kiosk scan QR tài xế
3. Tài xế vừa enable push notifications

**Action:**
- Bảo vệ scan QR (hoặc dashboard manual call + kiosk scan cùng lúc)

**Expected:**
- ✅ 1 notification (không phải 2)
- ✅ Có âm thanh + rung
- Vì: `sendPushToDelivery()` ở `checkin.ts` scan endpoint

---

### Scenario 4: Subscription Lifecycle - Expire handling

**Setup:**
1. Tài xế subscribe push, xem subscription lưu vào DB
2. Xóa subscription từ browser:
   ```javascript
   // DevTools Console
   navigator.serviceWorker.ready.then(reg => {
     reg.pushManager.getSubscription().then(sub => {
       if (sub) sub.unsubscribe();
     });
   });
   ```
3. Dashboard thử gọi xe (không phải tài xế)

**Action:**
- Backend `sendPushToDelivery()` sẽ nhận 410 Not Found

**Expected:**
- ✅ Backend log: `[WebPush] Subscription expired (410)...`
- ✅ Backend log: `[WebPush] Deleted 1 expired subscription(s)`
- ✅ Subscription tự động bị xóa từ database

---

## Debugging Checklist

### 1. Check Service Worker Status
```javascript
// DevTools Console
navigator.serviceWorker.ready.then(reg => {
  console.log('SW State:', reg.active ? 'ACTIVE' : 'INACTIVE');
  console.log('SW Registration:', reg);
});
```

### 2. Check Notification Permission
```javascript
console.log('Notification permission:', Notification.permission);
```

### 3. Check Push Subscription
```javascript
navigator.serviceWorker.ready.then(reg => {
  reg.pushManager.getSubscription().then(sub => {
    console.log('Push Subscription:', sub ? sub.toJSON() : 'NONE');
  });
});
```

### 4. Check Database Subscriptions
```sql
-- PostgreSQL
SELECT id, "deliveryCode", endpoint, "createdAt" 
FROM "PushSubscription" 
ORDER BY "createdAt" DESC LIMIT 10;
```

### 5. Monitor Backend Logs
```bash
# Terminal running backend
# Tìm logs: [WebPush], [Push]
```

### 6. Monitor Service Worker Logs
```
Chrome/Edge: DevTools → Console (filter by "SW")
Firefox: about:debugging → Inspect Service Worker
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Notification không hiển thị khi app mở | Service Worker chưa register | Check PWA setup, reload page |
| Push không gửi từ backend | Subscription chưa lưu | Confirm `/api/push/subscribe` được call + response OK |
| Âm thanh không phát | AudioContext suspended | Tap vào màn hình hoặc click button trước |
| Rung không work | Vibration API không support | Test trên Android device, không work trên Desktop |
| Push lost khi browser close | Subscription hết hạn | Re-enable notifications |
| Backend không log "[WebPush]" | Không có VAPID keys | Check `.env` có `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` |
| Double notifications | Multiple subscriptions | Check DB có bao nhiêu subscription cho delivery code đó |

---

## Test Checklist for Sign-off

- [ ] ✅ Scenario 1.1: Auto-assign - âm thanh + rung + notification
- [ ] ✅ Scenario 1.2: Manual call - âm thanh + rung + notification  
- [ ] ✅ Scenario 1.3: Start receiving - âm thanh + rung + notification
- [ ] ✅ Scenario 1.4: Complete - âm thanh + rung + notification
- [ ] ✅ Scenario 2: App closed - notification + rung (OS)
- [ ] ✅ Scenario 3: Kiosk - no double notifications
- [ ] ✅ Scenario 4: Subscription expire - auto-cleanup
- [ ] ✅ All console logs visible without errors
- [ ] ✅ Backend build success
- [ ] ✅ Frontend build success

---

## Next Steps (Post-Testing)

1. **If all tests pass:**
   - Mark Tác vụ 7 done ✓
   - Document test results in PLAN.md
   - Deploy to staging

2. **If issues found:**
   - Collect logs from debug checklist
   - Review backend/frontend console
   - Fix and re-test

3. **Performance tuning (Optional):**
   - Reduce payload size if needed
   - Add subscription refresh logic (resubscribe every N days)
   - Monitor push send latency

---

## Files Modified (Reference)

- ✅ `backend/src/routes/deliveries.ts` - added push calls to 3 endpoints
- ✅ `backend/src/routes/push.ts` - added logging
- ✅ `backend/src/services/webPush.ts` - improved logging
- ✅ `frontend/src/lib/pwa.ts` - improved SW registration
- ✅ `frontend/public/sw.js` - improved push handling + logging
- ✅ `frontend/src/pages/Track.tsx` - auto-request notification permission
