import type { ReceivingTimeConfig } from '../../lib/types';

export interface AnalyticsData {
  configs: ReceivingTimeConfig[];
  totalCompleted: number;
}

export type FlashMessage = { text: string; ok: boolean } | null;
