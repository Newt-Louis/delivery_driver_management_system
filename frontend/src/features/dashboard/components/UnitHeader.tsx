import { Card, Space, Statistic, Typography } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import type { UnitDispatch } from '../../../lib/types';
import type { UnitKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';
export default function UnitHeader({ unit, unitDispatch }: { unit: UnitKey; unitDispatch: UnitDispatch }) {
 const meta = getUnitMeta(unit, unitDispatch.unitConfig); const s = unitDispatch.insights.stats;
 const items = [['Đã đặt', s.registered], ['Chờ gọi', s.waiting], ['Đã gọi', s.called], ['Nhận hàng', s.receiving], ['Slot xe tải', s.truckSlotsAvailable ?? s.truckDocksAvailable], ['Slot xe máy', s.mbSlotsAvailable ?? s.mbDocksAvailable]] as const;
 return <Card className="mb-4" title={<Space><span style={{ display: 'inline-block', width: 8, height: 28, backgroundColor: meta.color }} /><UnitBrandMark meta={meta} />{meta.label}</Space>} extra={unitDispatch.insights.nextHour.count > 0 ? `${unitDispatch.insights.nextHour.count} xe đến 1h tới` : null}>{s.avgWaitMinutes !== null && <Typography.Paragraph type="secondary">Chờ TB: {s.avgWaitMinutes} phút</Typography.Paragraph>}<AdaptiveGrid minColumnWidth={120}>{items.map(([label, value]) => <Statistic key={label} title={label} value={value ?? '–'} />)}</AdaptiveGrid></Card>;
}
