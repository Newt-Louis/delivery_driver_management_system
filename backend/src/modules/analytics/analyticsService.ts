import { helperFunctions } from '../../helperFunction';
import type { AuthUser } from '../../middleware/auth';
import { roleHasUnitOperationScope } from '../../domain/permissions';
import { prisma } from '../../lib/prisma';
import * as analyticsRepository from './analyticsRepository';

async function resolveAnalyticsUnitConfigIds(user: AuthUser | undefined): Promise<string[] | undefined> {
  if (!user?.businessLocationId) return undefined;
  if (user.operationUnits?.length) return user.operationUnits.map((unit) => unit.id);
  if (roleHasUnitOperationScope(user.role)) return [];

  const units = await prisma.unitConfig.findMany({
    where: { businessLocationId: user.businessLocationId, isActive: true },
    select: { id: true },
  });
  return units.map((unit) => unit.id);
}

function statKey(stat: { unitConfigId?: string | null; unit: string; vehicleType: string; goodsType: string }) {
  return `${stat.unitConfigId ?? stat.unit}|${stat.vehicleType}|${stat.goodsType}`;
}

function confidence(sampleCount: number): 'high' | 'medium' | 'low' {
  if (sampleCount >= 20) return 'high';
  if (sampleCount >= 5) return 'medium';
  return 'low';
}

export async function getReceivingTimesOverview(user?: AuthUser) {
  const unitConfigIds = await resolveAnalyticsUnitConfigIds(user);
  const [configs, liveStats, totalCompleted] = await Promise.all([
    analyticsRepository.listReceivingTimeConfigs(unitConfigIds),
    analyticsRepository.listLiveReceivingTimeStats(unitConfigIds),
    analyticsRepository.countCompletedReceivingSamples(unitConfigIds),
  ]);

  const liveMap = new Map(liveStats.map((stat) => [statKey(stat), stat]));
  const enrichedConfigs = configs.map((config) => {
    const live = liveMap.get(statKey(config));
    const liveAvgMinutes = live ? helperFunctions.roundOne(live.avgMinutes) : null;
    const liveSampleCount = live ? Number(live.sampleCount) : 0;
    const diffMinutes = liveAvgMinutes !== null
      ? helperFunctions.roundOne(liveAvgMinutes - config.configuredMinutes)
      : null;

    return {
      ...config,
      configuredMinutes: config.configuredMinutes,
      liveAvgMinutes,
      liveSampleCount,
      diffMinutes,
      confidence: confidence(liveSampleCount),
      shouldUpdate: liveAvgMinutes !== null && Math.abs(liveAvgMinutes - config.configuredMinutes) > 2,
    };
  });

  return { configs: enrichedConfigs, totalCompleted };
}

export async function analyzeReceivingTimes(user?: AuthUser) {
  const unitConfigIds = await resolveAnalyticsUnitConfigIds(user);
  const liveStats = await analyticsRepository.listLiveReceivingTimeStats(unitConfigIds);

  let updated = 0;
  for (const stat of liveStats) {
    try {
      await analyticsRepository.updateRecommendedReceivingTime(stat);
      updated++;
    } catch {
      // Keep analysis best-effort so one broken group does not block all others.
    }
  }

  return {
    analyzed: liveStats.length,
    updated,
    message: `Đã phân tích ${liveStats.length} nhóm, cập nhật ${updated} cấu hình`,
  };
}

export async function acceptReceivingTimeRecommendation(id: string, user?: AuthUser) {
  const unitConfigIds = await resolveAnalyticsUnitConfigIds(user);
  const config = await analyticsRepository.getReceivingTimeConfig(id, unitConfigIds);
  if (!config) return { status: 'not_found' as const, config: null };
  if (config.recommendedMinutes === null) return { status: 'no_recommendation' as const, config: null };

  const updated = await analyticsRepository.acceptRecommendedReceivingTime(id, config.recommendedMinutes);
  return { status: 'ok' as const, config: updated };
}

export async function acceptAllReceivingTimeRecommendations(user?: AuthUser) {
  const unitConfigIds = await resolveAnalyticsUnitConfigIds(user);
  const pending = await analyticsRepository.listPendingReceivingTimeConfigs(unitConfigIds);
  let accepted = 0;

  for (const config of pending) {
    if (config.recommendedMinutes !== null && Math.abs(config.recommendedMinutes - config.configuredMinutes) > 0.05) {
      await analyticsRepository.acceptRecommendedReceivingTime(config.id, config.recommendedMinutes);
      accepted++;
    }
  }

  return { accepted, message: `Đã chấp nhận ${accepted} khuyến nghị` };
}
