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
  if (!PUBLIC_KEY) return;

  const subs = await prisma.pushSubscription.findMany({ where: { deliveryCode } });
  if (subs.length === 0) return;

  const data = JSON.stringify({ ...payload, icon: '/favicon.ico' });
  const expired: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data,
        );
      } catch (err: unknown) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 410 || code === 404) expired.push(s.endpoint);
        else console.error(`[WebPush] send error ${code}:`, (err as Error).message);
      }
    }),
  );

  if (expired.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired } } });
  }
}
