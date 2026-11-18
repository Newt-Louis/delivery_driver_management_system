import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { resolvePublicScope } from '../middleware/auth';
import { publicReadLimiter } from '../middleware/rateLimit';
import { buildWaitingBoard, resolveBoardBusinessLocationId } from '../modules/waitingScreen/waitingBoardService';

const router = Router();

// GET /api/waiting-screen/board?businessLocationId=… (or ?unitConfigId=…) — public TV board.
// Scope is required: unlike the legacy /api/deliveries/queue, no cross-location fallback.
router.get('/board', publicReadLimiter, resolvePublicScope, asyncHandler(async (req, res) => {
  const businessLocationId = await resolveBoardBusinessLocationId(req.scope);
  if (!businessLocationId) {
    res.status(400).json({ error: 'MissingScope', message: 'Cần businessLocationId hoặc unitConfigId.' });
    return;
  }
  res.json(await buildWaitingBoard(businessLocationId));
}));

export default router;
