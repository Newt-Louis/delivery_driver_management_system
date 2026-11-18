import { useState } from 'react';
import { ArrowRightOutlined, NotificationOutlined } from '@ant-design/icons';
import { Avatar, Badge, Card, Empty, Radio, Space, Table, Tag, Typography, theme, type TableColumnsType } from 'antd';
import type { VehicleType } from '../../../../lib/types';
import { countCalledInUnit } from '../../boardUtils';
import { getUnitBrand } from '../../utils';
import type {
  BrandConfig,
  UnitKey,
  WaitingBoardOccupant,
  WaitingBoardRowState,
  WaitingBoardUnit,
  WaitingBoardWaitingItem,
} from '../../types';

type BrightUnitPanelProps = {
  unitKey: UnitKey;
  unitBoard: WaitingBoardUnit | undefined;
  highlightId: string | null;
  cooldownSeconds: number | null;
  brand: BrandConfig | null;
  desktop: boolean;
};

const VEHICLE_GROUPS: Array<{ label: string; vehicleType: VehicleType }> = [
  { vehicleType: 'TRUCK', label: 'Xe tải' },
  { vehicleType: 'MOTORBIKE', label: 'Xe máy' },
];

const STATE_LABEL: Record<WaitingBoardRowState, string> = {
  EMPTY: 'Trống',
  CALLED: 'Đang gọi vào',
  RECEIVING: 'Đang nhận hàng',
  FOREIGN: 'Mượn slot',
  UNAVAILABLE: 'Tạm ngưng',
};
const LEGEND_ORDER: WaitingBoardRowState[] = ['EMPTY', 'CALLED', 'RECEIVING', 'FOREIGN', 'UNAVAILABLE'];

/** One display row of the slot board (rule R1: one row per capacity place). */
type BoardRow = {
  key: string;
  slotLabel: string;
  overCapacity: boolean;
  state: WaitingBoardRowState;
  occupant: WaitingBoardOccupant | null;
};

function useStateColors(): Record<WaitingBoardRowState, string> {
  const { token } = theme.useToken();
  return {
    EMPTY: token.colorSuccess,
    CALLED: token.colorPrimary,
    RECEIVING: token.colorError,
    FOREIGN: token.gold,
    UNAVAILABLE: token.colorTextQuaternary,
  };
}

function StatusCell({ state }: { state: WaitingBoardRowState }) {
  const colors = useStateColors();
  const { token } = theme.useToken();
  // Color only, no visible text (rule from PLAN 5): label kept for screen readers / tooltip.
  return (
    <div
      role="img"
      aria-label={STATE_LABEL[state]}
      title={STATE_LABEL[state]}
      style={{ background: colors[state], borderRadius: token.borderRadiusSM, height: 28, width: '100%' }}
    />
  );
}

function Legend() {
  const colors = useStateColors();
  const { token } = theme.useToken();
  return (
    <Space wrap size={[12, 4]}>
      {LEGEND_ORDER.map((state) => (
        <span key={state} className="inline-flex items-center gap-1">
          <span aria-hidden style={{ background: colors[state], borderRadius: token.borderRadiusXS, width: 14, height: 14, display: 'inline-block' }} />
          <Typography.Text type="secondary">{STATE_LABEL[state]}</Typography.Text>
        </span>
      ))}
    </Space>
  );
}

function VehicleTypeSwitch({ value, onChange, label }: { value: VehicleType; onChange: (value: VehicleType) => void; label: string }) {
  return (
    <Radio.Group
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as VehicleType)}
      optionType="button"
      buttonStyle="solid"
      size="small"
      options={VEHICLE_GROUPS.map((group) => ({ label: group.label, value: group.vehicleType }))}
    />
  );
}

function SlotBoardSection({ unitBoard, brand, highlightId, desktop }: { unitBoard: WaitingBoardUnit | undefined; brand: BrandConfig | null; highlightId: string | null; desktop: boolean }) {
  const { token } = theme.useToken();
  const [vehicleType, setVehicleType] = useState<VehicleType>('TRUCK');

  const rowsFor = (type: VehicleType): BoardRow[] => {
    if (!unitBoard) return [];
    const placeIndex = new Map<string, number>();
    const own = unitBoard.slotRows.filter((row) => row.vehicleType === type).map((row) => {
      const index = placeIndex.get(row.slotId) ?? 0;
      placeIndex.set(row.slotId, index + 1);
      return { key: `${row.slotId}:${index}`, slotLabel: row.slotName, overCapacity: row.overCapacity, state: row.state, occupant: row.occupant };
    });
    // Borrowed places go last, after the unit's own slots.
    const borrowed = unitBoard.borrowedRows.filter((row) => row.vehicleType === type).map((row) => ({
      key: `${row.slotId}:borrowed:${row.occupant.deliveryId}`,
      slotLabel: `${row.slotName} · ${getUnitBrand(brand, row.lenderUnit).shortName}`,
      overCapacity: false,
      state: row.state,
      occupant: row.occupant,
    }));
    return [...own, ...borrowed];
  };

  const columns: TableColumnsType<BoardRow> = [
    {
      title: 'Vị trí',
      key: 'slot',
      width: '30%',
      render: (_, row) => (
        <Space size={4} wrap>
          <Typography.Text strong className="break-words" title={row.slotLabel}>{row.slotLabel}</Typography.Text>
          {row.overCapacity && <Tag color="error" className="!m-0">Vượt sức chứa</Tag>}
        </Space>
      ),
    },
    {
      title: 'Số thứ tự',
      key: 'ticket',
      width: '28%',
      render: (_, row) => row.occupant
        ? <Typography.Text strong className="break-words">{row.occupant.ticketCode ?? '—'}</Typography.Text>
        : <Typography.Text type="secondary">{row.state === 'UNAVAILABLE' ? 'Tạm ngưng' : 'Trống'}</Typography.Text>,
    },
    {
      title: 'Biển số xe',
      key: 'plate',
      width: '27%',
      render: (_, row) => row.occupant
        ? <Typography.Text strong className="break-words text-base">{row.occupant.vehiclePlate}</Typography.Text>
        : <Typography.Text type="secondary">—</Typography.Text>,
    },
    { title: 'Trạng thái', key: 'state', width: '15%', render: (_, row) => <StatusCell state={row.state} /> },
  ];

  return (
    <section className="min-w-0">
      <div className="flex flex-col items-start gap-2 pb-3">
        <span className="inline-flex items-center gap-2">
          <Badge status="processing" />
          <Typography.Text strong style={{ color: token.colorPrimary, fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}>
            <NotificationOutlined className="mr-1" />Tình trạng vị trí
          </Typography.Text>
        </span>
        <Legend />
        {!desktop && <VehicleTypeSwitch value={vehicleType} onChange={setVehicleType} label="Chọn loại xe: tình trạng vị trí" />}
      </div>
      <div className={desktop ? 'grid grid-cols-2 gap-3' : ''}>
        {VEHICLE_GROUPS.filter((group) => desktop || group.vehicleType === vehicleType).map((group) => {
          const rows = rowsFor(group.vehicleType);
          return (
            <Card key={group.vehicleType} size="small" className="min-w-0" styles={{ body: { padding: 0 } }} title={group.label}>
              {rows.length ? (
                <Table
                  className="waiting-vehicle-table"
                  columns={columns}
                  dataSource={rows}
                  rowKey="key"
                  pagination={false}
                  size="small"
                  tableLayout="fixed"
                  rowClassName={(row) => row.occupant && row.occupant.deliveryId === highlightId ? 'waiting-vehicle-table-highlight' : ''}
                />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có vị trí" className="my-5" />
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function WaitingSection({ unitBoard, desktop }: { unitBoard: WaitingBoardUnit | undefined; desktop: boolean }) {
  const { token } = theme.useToken();
  const [vehicleType, setVehicleType] = useState<VehicleType>('TRUCK');
  const waitingTotal = unitBoard?.waitingTotal ?? {};
  const total = (waitingTotal.TRUCK ?? 0) + (waitingTotal.MOTORBIKE ?? 0);

  const columns = (items: WaitingBoardWaitingItem[]): TableColumnsType<WaitingBoardWaitingItem> => [
    {
      title: 'Số thứ tự',
      key: 'ticket',
      width: '45%',
      render: (_, item) => (
        <Typography.Text strong className="break-words">
          {items[0]?.deliveryId === item.deliveryId && <ArrowRightOutlined className="mr-1 text-[var(--ant-color-warning)]" />}
          {item.ticketCode ?? '—'}
        </Typography.Text>
      ),
    },
    {
      title: 'Biển số xe',
      key: 'plate',
      width: '55%',
      render: (_, item) => <Typography.Text strong className="break-words text-base">{item.vehiclePlate}</Typography.Text>,
    },
  ];

  return (
    <section className="min-w-0">
      <div className="flex flex-col items-start gap-3 pb-3">
        <span className="inline-flex items-center gap-2">
          <Badge status="warning" />
          <Typography.Text strong style={{ color: token.colorWarning, fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)' }}>
            Đã check-in / Đang chờ ({total})
          </Typography.Text>
        </span>
        {!desktop && <VehicleTypeSwitch value={vehicleType} onChange={setVehicleType} label="Chọn loại xe: đã check-in và đang chờ" />}
      </div>
      <div className={desktop ? 'grid grid-cols-2 gap-3' : ''}>
        {VEHICLE_GROUPS.filter((group) => desktop || group.vehicleType === vehicleType).map((group) => {
          // Server already limits to the next 10 vehicles in line per vehicle type (no pagination).
          const items = (unitBoard?.waiting ?? []).filter((item) => item.vehicleType === group.vehicleType);
          const groupTotal = waitingTotal[group.vehicleType] ?? 0;
          return (
            <Card
              key={group.vehicleType}
              size="small"
              className="min-w-0"
              styles={{ body: { padding: 0 } }}
              title={`${group.label} (${groupTotal})`}
            >
              {items.length ? (
                <Table className="waiting-vehicle-table" columns={columns(items)} dataSource={items} rowKey="deliveryId" pagination={false} size="small" tableLayout="fixed" />
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có xe CHECK-IN" className="my-5" />
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export default function BrightUnitPanel({ unitKey, unitBoard, highlightId, brand, desktop, cooldownSeconds }: BrightUnitPanelProps) {
  const config = getUnitBrand(brand, unitKey);
  const calledCount = countCalledInUnit(unitBoard);

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
        <SlotBoardSection unitBoard={unitBoard} brand={brand} highlightId={highlightId} desktop={desktop} />
        <WaitingSection unitBoard={unitBoard} desktop={desktop} />
      </div>
    </Card>
  );
}
