import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { getUiConfig } from '../services/appConfig';

const router = Router();

// GET /api/config/public — no auth, returns UI-safe runtime configs
router.get('/public', asyncHandler(async (_req: Request, res: Response) => {
  const ui = await getUiConfig();
  res.json({ ui });
}));

export default router;
