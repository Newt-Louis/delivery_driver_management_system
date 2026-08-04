import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, enforceScope, requireRole } from '../middleware/auth';
import { AnalyticsFormRequest } from '../modules/analytics/analyticsFormRequest';
import {
  acceptAllReceivingTimeRecommendations,
  acceptReceivingTimeRecommendation,
  analyzeReceivingTimes,
  getReceivingTimesOverview,
} from '../modules/analytics/analyticsService';

const router = Router();
router.use(authenticate, enforceScope);

router.get(
  '/receiving-times',
  requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await getReceivingTimesOverview(req.user));
  }),
);

router.post(
  '/receiving-times/analyze',
  requireRole('SUPERADMIN', 'ADMIN_LOC'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await analyzeReceivingTimes(req.user));
  }),
);

router.patch(
  '/receiving-times/:id/accept',
  requireRole('SUPERADMIN', 'ADMIN_LOC'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = AnalyticsFormRequest.parseConfigId(req.params.id);
    const result = await acceptReceivingTimeRecommendation(id, req.user);

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Không tìm thấy cấu hình' });
      return;
    }

    if (result.status === 'no_recommendation') {
      res.status(400).json({ error: 'Chưa có khuyến nghị để chấp nhận. Chạy phân tích trước.' });
      return;
    }

    res.json(result.config);
  }),
);

router.patch(
  '/receiving-times/accept-all',
  requireRole('SUPERADMIN', 'ADMIN_LOC'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await acceptAllReceivingTimeRecommendations(req.user));
  }),
);

export default router;
