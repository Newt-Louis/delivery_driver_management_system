import { Alert, Button, Card, Empty, Spin, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import { fetchSlotPerformance } from '../api';
import { VEHICLE_LABEL } from '../constants';
import { fmt, unitLabel } from '../utils';
import UtilBar from '../components/UtilBar';
import ExportBtn from '../components/ExportBtn';
import type { SlotPerf } from '../types';
export default function SlotTab({ from, to, unit, unitLabels }: { from: string; to: string; unit: string; unitLabels: Record<string, string> }) {
 const { data = [], isLoading, isError, refetch } = useQuery<SlotPerf[]>({ queryKey: ['reports-slots', from, to, unit], queryFn: () => fetchSlotPerformance({ from, to, unit }) });
 if (isLoading) return <Spin />; if (isError) return <Alert type="error" message="Không thể tải hiệu suất slot" action={<Button onClick={() => refetch()}>Thử lại</Button>} />;
 const units = [...new Set(data.map(s => s.assignedUnit))];
 return <div className="space-y-4"><div className="flex justify-end"><ExportBtn onClick={() => downloadCsv('hieu-suat-slot', ['Slot', 'Tên slot', 'Đơn vị', 'Loại xe', 'Tổng lượt', 'Hoàn tất', 'Tỷ lệ HT (%)', 'TB nhận (phút)', 'Min (phút)', 'Max (phút)', 'Utilization (%)'], data.map(s => [s.slotCode, s.slotName, unitLabel(unitLabels, s.assignedUnit), VEHICLE_LABEL[s.vehicleType] ?? s.vehicleType, s.totalDeliveries, s.completedDeliveries, s.completionRate, s.avgReceivingMinutes ?? '', s.minReceivingMinutes ?? '', s.maxReceivingMinutes ?? '', s.utilizationPct]))} /></div><Alert type="info" showIcon message="Hướng dẫn đọc báo cáo" description="Utilization = tổng phút thực tế nhận hàng ÷ (số ngày × 15h/ngày). 30–65%: tối ưu; từ 85%: cần thêm slot; dưới 25%: xem xét thu hẹp." />{units.map(key => <Card key={key} title={unitLabel(unitLabels, key)}><Table<SlotPerf> rowKey="slotId" pagination={false} scroll={{ x: 900 }} dataSource={data.filter(s => s.assignedUnit === key)} columns={[{ title: 'Slot', render: (_, s) => <>{s.slotCode}<div>{s.slotName}</div></> }, { title: 'Loại xe', render: (_, s) => VEHICLE_LABEL[s.vehicleType] ?? s.vehicleType }, { title: 'Tổng lượt', dataIndex: 'totalDeliveries' }, { title: 'Hoàn tất', render: (_, s) => `${s.completedDeliveries} (${s.completionRate}%)` }, { title: 'TB nhận (phút)', render: (_, s) => fmt(s.avgReceivingMinutes) }, { title: 'Min / Max', render: (_, s) => `${fmt(s.minReceivingMinutes)} / ${fmt(s.maxReceivingMinutes)}` }, { title: 'Utilization', render: (_, s) => <UtilBar pct={s.utilizationPct} /> }]} /></Card>)}{!data.length && <Empty description="Chưa có dữ liệu slot" />}</div>;
}
