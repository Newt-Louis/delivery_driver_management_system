import { Alert, Button, Card, Empty, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import { downloadCsv } from '../../../lib/export';
import { fetchBreakdown } from '../api';
import { GOODS_LABEL, VEHICLE_LABEL } from '../constants';
import { unitLabel } from '../utils';
import BarRow from '../components/BarRow';
import ExportBtn from '../components/ExportBtn';
import type { Breakdown } from '../types';
export default function BreakdownTab({ from, to, unit, unitLabels }: { from: string; to: string; unit: string; unitLabels: Record<string, string> }) {
 const { data, isLoading, isError, refetch } = useQuery<Breakdown>({ queryKey: ['reports-breakdown', from, to, unit], queryFn: () => fetchBreakdown({ from, to, unit }) });
 if (isLoading) return <Spin />; if (isError || !data) return <Alert type="error" message="Không thể tải báo cáo" action={<Button onClick={() => refetch()}>Thử lại</Button>} />;
 const groups = [{ label: 'Theo loại hàng hóa', items: data.byGoods, name: (k: string) => GOODS_LABEL[k] ?? k }, { label: 'Theo loại phương tiện', items: data.byVehicle, name: (k: string) => VEHICLE_LABEL[k] ?? k }, { label: 'Theo đơn vị nhận hàng', items: data.byUnit, name: (k: string) => unitLabel(unitLabels, k) }];
 return <><div className="flex justify-end mb-3"><ExportBtn onClick={() => downloadCsv('phan-tich-giao-hang', ['Nhóm', 'Loại', 'Số lượt'], [...data.byGoods.map(r => ['Loại hàng', GOODS_LABEL[r.key] ?? r.key, r.count]), ...data.byVehicle.map(r => ['Loại xe', VEHICLE_LABEL[r.key] ?? r.key, r.count]), ...data.byUnit.map(r => ['Đơn vị', unitLabel(unitLabels, r.key), r.count])])} /></div><AdaptiveGrid minColumnWidth={280}>{groups.map(g => <Card key={g.label} title={g.label}>{g.items.length ? g.items.map(r => <BarRow key={r.key} label={g.name(r.key)} value={r.count} max={Math.max(1, ...g.items.map(x => x.count))} />) : <Empty description="Không có dữ liệu" />}</Card>)}</AdaptiveGrid></>;
}
