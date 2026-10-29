import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { vapidPublicKey } from '../services/webPush';
import { publicWriteLimiter } from '../middleware/rateLimit';

const router = Router();

// GET /api/push/vapid-public-key — frontend needs this to subscribe
router.get('/vapid-public-key', (_req, res) => {
  if (!vapidPublicKey) {
    res.status(503).json({ error: 'Push notifications not configured' });
    return;
  }
  res.json({ publicKey: vapidPublicKey });
});

// POST /api/push/subscribe — register or refresh a push subscription
router.post('/subscribe', publicWriteLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { subscription, deliveryCode } = req.body as {
    subscription?: { endpoint: string; keys: { p256dh: string; auth: string } };
    deliveryCode?: string;
  };

  if (typeof subscription?.endpoint !== 'string' || !subscription.endpoint.startsWith('https://')
    || typeof subscription.keys?.p256dh !== 'string' || !subscription.keys.p256dh
    || typeof subscription.keys?.auth !== 'string' || !subscription.keys.auth) {
    res.status(400).json({ error: 'Invalid subscription object' });
    return;
  }
  if (typeof deliveryCode !== 'string' || !deliveryCode.trim()) {
    res.status(400).json({ error: 'deliveryCode required' });
    return;
  }

  const code = deliveryCode.trim().toUpperCase();
  const delivery = await prisma.deliveryRegistration.findUnique({ where: { registrationCode: code }, select: { status: true } });
  if (!delivery || ['COMPLETED', 'CANCELLED', 'EXPIRED', 'INCOMPLETED'].includes(delivery.status)) {
    res.status(409).json({ error: 'Chuyến này không còn nhận thông báo.' });
    return;
  }

  const result = await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      endpoint:     subscription.endpoint,
      p256dh:       subscription.keys.p256dh,
      auth:         subscription.keys.auth,
      deliveryCode: deliveryCode.trim().toUpperCase(),
    },
    update: {
      p256dh:       subscription.keys.p256dh,
      auth:         subscription.keys.auth,
      deliveryCode: deliveryCode.trim().toUpperCase(),
    },
  });

  // A terminal transition may race with the upsert above.
  const latest = await prisma.deliveryRegistration.findUnique({ where: { registrationCode: code }, select: { status: true } });
  if (!latest || ['COMPLETED', 'CANCELLED', 'EXPIRED', 'INCOMPLETED'].includes(latest.status)) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: subscription.endpoint, deliveryCode: code } });
    res.status(409).json({ error: 'Chuyến này đã kết thúc.' });
    return;
  }

  console.log('[Push] Subscription saved:', {
    deliveryCode: result.deliveryCode,
    endpoint: result.endpoint.substring(0, 50) + '...',
  });

  res.json({ ok: true, message: 'Subscription saved successfully' });
}));

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', asyncHandler(async (req: Request, res: Response) => {
  const { endpoint, deliveryCode } = req.body as { endpoint?: string; deliveryCode?: string };
  if (typeof endpoint !== 'string' || !endpoint || (deliveryCode !== undefined && typeof deliveryCode !== 'string')) {
    res.status(400).json({ error: 'Invalid endpoint or deliveryCode' }); return;
  }
  await prisma.pushSubscription.deleteMany({ where: { endpoint, ...(deliveryCode ? { deliveryCode: deliveryCode.trim().toUpperCase() } : {}) } });
  res.json({ ok: true });
}));

export default router;
