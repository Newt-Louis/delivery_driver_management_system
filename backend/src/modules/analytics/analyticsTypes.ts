import { ReceivingTimeConfig } from '@prisma/client';

export type LiveReceivingTimeStat = {
  unit: string;
  vehicleType: string;
  goodsType: string;
  avgMinutes: number;
  sampleCount: bigint;
};

export type ReceivingTimeConfigWithStats = ReceivingTimeConfig & {
  liveAvgMinutes: number | null;
  liveSampleCount: number;
  diffMinutes: number | null;
  confidence: 'high' | 'medium' | 'low';
  shouldUpdate: boolean;
};

export type ReceivingTimesOverview = {
  configs: ReceivingTimeConfigWithStats[];
  totalCompleted: number;
};

export type AnalyzeReceivingTimesResult = {
  analyzed: number;
  updated: number;
  message: string;
};

export type AcceptAllReceivingTimesResult = {
  accepted: number;
  message: string;
};
