import type { ReceivingTimeConfig } from '../../lib/types';
import { unitPresentation } from '../../lib/unitPresentation';
import { GOODS_LABEL, VT_LABEL } from './constants';

export function getUnitMeta(config: ReceivingTimeConfig) {
  return unitPresentation(config.unit, config.unitConfig);
}

export function groupReceivingTimeConfigs(configs: ReceivingTimeConfig[]) {
  return [...new Set(configs.map((config) => config.unitConfigId ?? config.unit))].map((key) => {
    const items = configs.filter((config) => (config.unitConfigId ?? config.unit) === key);
    return { key, items, meta: getUnitMeta(items[0]) };
  });
}

export function buildReceivingTimesCsvRows(configs: ReceivingTimeConfig[]) {
  return configs.map((config) => [
    getUnitMeta(config).label,
    VT_LABEL[config.vehicleType] ?? config.vehicleType,
    GOODS_LABEL[config.goodsType] ?? config.goodsType,
    config.configuredMinutes,
    config.recommendedMinutes ?? '',
    config.liveAvgMinutes ?? '',
    config.liveSampleCount ?? config.sampleCount,
    config.confidence ?? '',
    config.diffMinutes != null ? Math.round(config.diffMinutes * 10) / 10 : '',
  ]);
}

export function getReceivingTimesSummary(configs: ReceivingTimeConfig[], totalCompleted?: number) {
  const pendingCount = configs.filter((config) => config.shouldUpdate).length;
  return [
    { label: 'Đơn đã phân tích', value: totalCompleted ?? '—', icon: '📦' },
    { label: 'Cấu hình có khuyến nghị', value: configs.filter((config) => config.recommendedMinutes !== null).length, icon: '🤖' },
    { label: 'Chờ chấp nhận', value: pendingCount, icon: '⚠️', alert: pendingCount > 0 },
    { label: 'Đã tối ưu', value: configs.filter((config) => !config.shouldUpdate && config.sampleCount > 0).length, icon: '✅' },
  ];
}
