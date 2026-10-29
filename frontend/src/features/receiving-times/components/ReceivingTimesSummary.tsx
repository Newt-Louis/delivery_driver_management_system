import { Card, Statistic } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import type { ReceivingTimeConfig } from '../../../lib/types';
import { getReceivingTimesSummary } from '../utils';
export default function ReceivingTimesSummary({ configs, totalCompleted }: { configs: ReceivingTimeConfig[]; totalCompleted?: number }) {
 return <div className="mb-6"><AdaptiveGrid minColumnWidth={160}>{getReceivingTimesSummary(configs, totalCompleted).map(item => <Card key={item.label} size="small"><Statistic title={item.label} value={item.value} /></Card>)}</AdaptiveGrid></div>;
}
