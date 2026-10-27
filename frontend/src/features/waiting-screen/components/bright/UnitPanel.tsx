import { NotificationOutlined } from '@ant-design/icons';
import { Avatar, Card, Space, Typography } from 'antd';
import type { DeliveryRegistration, VehicleType } from '../../../../lib/types';
import { compareWaitingScreenQueueOrder, getUnitBrand } from '../../utils';
import type { BrandConfig, UnitKey } from '../../types';
import BrightVehicleSection from './VehicleSection';

type BrightUnitPanelProps = {
  unitKey: UnitKey;
  deliveries: DeliveryRegistration[];
  highlightId: string | null;
  cooldownSeconds: number | null;
  brand: BrandConfig | null;
  desktop: boolean;
};

type VehicleGroupProps = {
  label: string;
  vehicleType: VehicleType;
  deliveries: DeliveryRegistration[];
  highlightId: string | null;
};

const VEHICLE_GROUPS: Array<Pick<VehicleGroupProps, 'label' | 'vehicleType'>> = [
  { vehicleType: 'TRUCK', label: 'Xe tải' },
  { vehicleType: 'MOTORBIKE', label: 'Xe máy' },
  { vehicleType: 'OTHER', label: 'Xe khác' },
];

function VehicleGroup({ label, vehicleType, deliveries, highlightId }: VehicleGroupProps) {
  const matching = deliveries.filter((delivery) => delivery.vehicleType === vehicleType);
  const called = matching.filter((delivery) => delivery.status === 'CALLED').sort(compareWaitingScreenQueueOrder);
  const waiting = matching.filter((delivery) => delivery.status === 'WAITING').sort(compareWaitingScreenQueueOrder);

  return (
    <Card
      size="small"
      className="min-w-0"
      styles={{ body: { padding: 0 } }}
      title={(
        <Space size={8}>
          <Typography.Text strong style={{ fontSize: 'clamp(1.25rem, 3.75vw, 2rem)', lineHeight: 1.2 }}>{label}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 'clamp(1.25rem, 3.75vw, 2rem)' }}>({matching.length})</Typography.Text>
        </Space>
      )}
    >
      <BrightVehicleSection items={called} highlightId={highlightId} status="called" waitingCount={waiting.length} />
      <BrightVehicleSection items={waiting} highlightId={highlightId} status="waiting" />
    </Card>
  );
}

export default function BrightUnitPanel({ unitKey, deliveries, highlightId, brand, desktop, cooldownSeconds }: BrightUnitPanelProps) {
  const config = getUnitBrand(brand, unitKey);
  const calledCount = deliveries.filter((delivery) => delivery.status === 'CALLED').length;

  return (
    <Card
      className={`waiting-unit-card min-w-0 overflow-hidden ${desktop ? 'h-full' : ''}`}
      cover={<div aria-hidden className="h-10" style={{ backgroundColor: config.primaryColor }} />}
      styles={{ body: desktop ? { height: 'calc(100% - 40px)', overflowY: 'auto', padding: 0 } : { padding: 0 } }}
    >
      <div className="flex items-center justify-center px-4 py-3">
        <Space size={36} wrap className="justify-center">
          <Space size={10} className="min-w-0">
            <Avatar
              size={40}
              style={{ width: 'clamp(2rem, 5vw, 3rem)', height: 'clamp(2rem, 5vw, 3rem)', fontSize: 'clamp(1rem, 2.5vw, 1.5rem)' }}
              src={config.logoUrl ?? undefined}
            >
              {config.logoUrl ? undefined : config.icon}
            </Avatar>
            <Typography.Title level={4} ellipsis className="!mb-0 min-w-0" style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)', lineHeight: 1.15 }} title={config.displayName ?? undefined}>
              {config.displayName}
            </Typography.Title>
          </Space>
          <Typography.Text type="danger" className="!leading-none" style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}><NotificationOutlined className="mr-1" style={{ fontSize: '1em' }} />{calledCount}</Typography.Text>
          {cooldownSeconds !== null && <Typography.Text type="secondary" className="!leading-none" style={{ fontSize: 'clamp(1.5rem, 5vw, 3rem)' }}>({cooldownSeconds})</Typography.Text>}
        </Space>
      </div>
      <div className={desktop ? 'grid grid-cols-3 gap-3 px-3 pb-3' : 'space-y-3 px-3 pb-3'}>
        {VEHICLE_GROUPS.map((group) => (
          <VehicleGroup key={group.vehicleType} {...group} deliveries={deliveries} highlightId={highlightId} />
        ))}
      </div>
    </Card>
  );
}
