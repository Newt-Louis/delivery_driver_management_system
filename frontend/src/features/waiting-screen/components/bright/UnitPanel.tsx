import { useEffect, useRef, useState } from 'react';
import { NotificationOutlined } from '@ant-design/icons';
import { Avatar, Badge, Button, Card, Radio, Space, Typography, theme } from 'antd';
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

type StatusGroupProps = {
  status: 'called' | 'waiting';
  deliveries: DeliveryRegistration[];
  highlightId: string | null;
  desktop: boolean;
};

const VEHICLE_GROUPS: Array<{ label: string; vehicleType: VehicleType }> = [
  { vehicleType: 'TRUCK', label: 'Xe tải' },
  { vehicleType: 'MOTORBIKE', label: 'Xe máy' },
];

const PAGE_SIZE = 20;

function StatusGroup({ status, deliveries, highlightId, desktop }: StatusGroupProps) {
  const { token } = theme.useToken();
  const [vehicleType, setVehicleType] = useState<VehicleType>('TRUCK');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isWaiting = status === 'waiting';
  const groups = VEHICLE_GROUPS.map((group) => ({
    ...group,
    items: deliveries.filter((delivery) => delivery.vehicleType === group.vehicleType && delivery.status === (isWaiting ? 'WAITING' : 'CALLED')).sort(compareWaitingScreenQueueOrder),
    waitingCount: deliveries.filter((delivery) => delivery.vehicleType === group.vehicleType && delivery.status === 'WAITING').length,
  }));
  const total = groups.reduce((sum, group) => sum + group.items.length, 0);
  const hasMore = groups.some((group) => (desktop || group.vehicleType === vehicleType) && group.items.length > visibleCount);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!hasMore || !sentinel || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => count + PAGE_SIZE);
    }, { rootMargin: '100px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, visibleCount, desktop, vehicleType]);

  return (
    <section className="min-w-0">
        <div className="flex flex-col items-start gap-3 pb-3">
          <span className="inline-flex items-center gap-2">
            <Badge status={isWaiting ? 'warning' : 'processing'} />
            <Typography.Text strong style={{ color: isWaiting ? token.colorWarning : token.colorPrimary, fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}>
              {!isWaiting && <NotificationOutlined className="mr-1" />}
              {isWaiting ? 'Đã check-in và đang chờ' : 'Đang gọi vào'} ({total})
            </Typography.Text>
          </span>
          {!desktop && (
            <Radio.Group
              aria-label={`Chọn loại xe: ${isWaiting ? 'đã check-in và đang chờ' : 'đang gọi vào'}`}
              value={vehicleType}
              onChange={(event) => setVehicleType(event.target.value as VehicleType)}
              optionType="button"
              buttonStyle="solid"
              size="small"
              options={VEHICLE_GROUPS.map((group) => ({ label: group.label, value: group.vehicleType }))}
            />
          )}
        </div>
      <div className={desktop ? 'grid grid-cols-2 gap-3' : ''}>
        {groups.filter((group) => desktop || group.vehicleType === vehicleType).map((group) => (
          <Card key={group.vehicleType} size="small" className="min-w-0" styles={{ body: { padding: 0 } }} title={`${group.label} (${group.items.length})`}>
            <BrightVehicleSection items={group.items.slice(0, visibleCount)} highlightId={highlightId} status={status} waitingCount={group.waitingCount} />
          </Card>
        ))}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center pt-3">
          <Button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>Xem thêm</Button>
        </div>
      )}
    </section>
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
      <div className="space-y-3 px-3 pb-3">
        <StatusGroup status="called" deliveries={deliveries} highlightId={highlightId} desktop={desktop} />
        <StatusGroup status="waiting" deliveries={deliveries} highlightId={highlightId} desktop={desktop} />
      </div>
    </Card>
  );
}
