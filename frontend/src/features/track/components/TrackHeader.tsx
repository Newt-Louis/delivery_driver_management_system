import { EnvironmentOutlined } from '@ant-design/icons';
import { Avatar, Badge, Card, Space, Typography } from 'antd';
import { getTrackUnit } from '../utils';
import type { TrackDelivery } from '../types';

type UnitMeta = ReturnType<typeof getTrackUnit>;

export default function TrackHeader({ delivery, unitMeta, isUrgentQueue }: {
  delivery: TrackDelivery;
  unitMeta: UnitMeta;
  isUrgentQueue: boolean;
}) {
  return (
    <header className="sticky top-[60px] z-10 px-4 pt-4 sm:px-6">
      <Card size="small" className={isUrgentQueue ? 'border-warning' : undefined}>
        <div className="flex items-center justify-between gap-3"><div className="min-w-0"><Typography.Text type="secondary" className="text-xs">Theo dõi giao hàng</Typography.Text><Typography.Text className="block truncate font-mono text-base font-bold" copyable>{delivery.registrationCode}</Typography.Text></div><Space size={6} className="shrink-0">{isUrgentQueue && <Badge status="warning" />}<Avatar size="small" src={unitMeta.logoUrl ?? undefined} icon={<EnvironmentOutlined />}>{unitMeta.logoUrl ? undefined : unitMeta.icon}</Avatar><Typography.Text className="hidden max-w-28 truncate text-xs font-medium sm:inline">{unitMeta.shortName}</Typography.Text></Space></div>
      </Card>
    </header>
  );
}
