import { ReceivingTimeConfig } from '@prisma/client';

export type LiveReceivingTimeStat = {
  unitConfigId: string | null;
  unit: string;
  vehicleType: string;
  goodsType: string;
  avgMinutes: number;
  sampleCount: bigint;
};

export type ReceivingTimeConfigWithStats = ReceivingTimeConfig & {
  unitConfig?: {
    id: string;
    unit: string;
    displayName: string;
    shortName: string;
    icon: string | null;
    logoUrl: string | null;
    primaryColor: string;
    businessLocationId: string;
  } | null;
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
