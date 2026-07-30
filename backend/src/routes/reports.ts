import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole, enforceScope } from '../middleware/auth';
import { ReportFormRequest } from '../modules/reports/reportFormRequest';
import { resolveReportScope } from '../modules/reports/reportScope';
import {
  getAiSlotRecommendationsReport,
  getBreakdownReport,
  getDailyTrendReport,
  getHourlyHeatmapReport,
  getOverviewReport,
  getSlotPerformanceReport,
} from '../modules/reports/reportService';

const router = Router();
router.use(authenticate, enforceScope, requireRole('SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'));

async function reportContext(req: Request) {
  const query = ReportFormRequest.parseReportQuery(req.query as Record<string, unknown>);
  const scope = await resolveReportScope(req.user, query.unit);
  return { query, scope };
}

router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  const { query, scope } = await reportContext(req);
  res.json(await getOverviewReport(query, scope));
}));

router.get('/breakdown', asyncHandler(async (req: Request, res: Response) => {
  const { query, scope } = await reportContext(req);
  res.json(await getBreakdownReport(query, scope));
}));

router.get('/daily-trend', asyncHandler(async (req: Request, res: Response) => {
  const { query, scope } = await reportContext(req);
  res.json(await getDailyTrendReport(query, scope));
}));

router.get('/hourly-heatmap', asyncHandler(async (req: Request, res: Response) => {
  const { query, scope } = await reportContext(req);
  res.json(await getHourlyHeatmapReport(query, scope));
}));

router.get('/slot-performance', asyncHandler(async (req: Request, res: Response) => {
  const { query, scope } = await reportContext(req);
  res.json(await getSlotPerformanceReport(query, scope));
}));

router.get('/ai-slot-recommendations', asyncHandler(async (req: Request, res: Response) => {
  const { query, scope } = await reportContext(req);
  res.json(await getAiSlotRecommendationsReport(query, scope));
}));

export default router;
