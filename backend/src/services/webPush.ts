import webpush from 'web-push';
import { prisma } from '../lib/prisma';

const PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? '';
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const SUBJECT     = process.env.VAPID_SUBJECT     ?? 'mailto:admin@mallqms.local';

export const vapidPublicKey = PUBLIC_KEY;

export function initWebPush() {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.warn('[WebPush] VAPID keys not set — push notifications disabled. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in environment.');
    return;
  }
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
  console.log('[WebPush] Initialized');
}

export async function sendPushToDelivery(
  deliveryCode: string,
  payload: { title: string; body: string; url?: string; tag?: string },
) {
  if (!PUBLIC_KEY || !PRIVATE_KEY) {
    console.warn('[WebPush] VAPID keys not configured, skipping push for', deliveryCode);
    return;
  }

  const subs = await prisma.pushSubscription.findMany({ where: { deliveryCode } });
  if (subs.length === 0) {
    console.log('[WebPush] No subscriptions found for delivery:', deliveryCode);
    return;
  }

  console.log(`[WebPush] Sending push to ${subs.length} subscription(s) for delivery: ${deliveryCode}`, { title: payload.title });

  const data = JSON.stringify({
    ...payload,
    icon: '/icons/icon-192.png',
    badge: '/icons/maskable-192.png',
    vibrate: [300, 120, 300, 120, 600],
  });
  const expired: string[] = [];
  let successCount = 0;

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
          { TTL: 60 * 60, urgency: 'high' },
        );
        successCount++;
        console.log(`[WebPush] ✓ Sent to ${s.endpoint.substring(0, 50)}...`);
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 410 || code === 404) {
          expired.push(s.endpoint);
          console.log(`[WebPush] Subscription expired (${code}), will delete: ${s.endpoint.substring(0, 50)}...`);
        } else {
          console.error(`[WebPush] Send failed (${code}):`, (err as Error).message);
        }
      }
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
    console.log(`[WebPush] Deleted ${expired.length} expired subscription(s)`);
  }

  console.log(`[WebPush] Summary: ${successCount} sent, ${expired.length} expired`);
}
