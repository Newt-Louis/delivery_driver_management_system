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

  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    res.status(400).json({ error: 'Invalid subscription object' });
    return;
  }
  if (!deliveryCode) {
    res.status(400).json({ error: 'deliveryCode required' });
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

  console.log('[Push] Subscription saved:', {
    deliveryCode: result.deliveryCode,
    endpoint: result.endpoint.substring(0, 50) + '...',
  });

  res.json({ ok: true, message: 'Subscription saved successfully' });
}));

// DELETE /api/push/unsubscribe
router.delete('/unsubscribe', asyncHandler(async (req: Request, res: Response) => {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) { res.status(400).json({ error: 'endpoint required' }); return; }
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  res.json({ ok: true });
}));

export default router;
