import { Button, Input, Select, Space, Typography } from 'antd';
import { STATUS_FILTER_OPTIONS, VEHICLE_FILTER_OPTIONS } from '../constants';
import type { StatusFilter, VehicleTypeFilter } from '../types';
interface Props { search: string; onSearch: (value: string) => void; statusFilter: StatusFilter; onStatus: (value: StatusFilter) => void; vehicleFilter: VehicleTypeFilter; onVehicle: (value: VehicleTypeFilter) => void; total: number; onExport: () => void; }
export default function FilterBar({ search, onSearch, statusFilter, onStatus, vehicleFilter, onVehicle, total, onExport }: Props) {
  return <Space wrap className="mb-3" style={{ width: '100%' }}><Input allowClear aria-label="Tìm kiếm xe" placeholder="Tìm biển số, số thẻ, nhà CC..." value={search} onChange={(e) => onSearch(e.target.value)} style={{ width: 240, maxWidth: '100%' }} /><Select aria-label="Trạng thái" value={statusFilter} onChange={onStatus} options={STATUS_FILTER_OPTIONS.map(o => ({ value: o.k, label: o.label }))} style={{ minWidth: 140 }} /><Select aria-label="Loại xe" value={vehicleFilter} onChange={onVehicle} options={VEHICLE_FILTER_OPTIONS.map(o => ({ value: o.k, label: o.label }))} style={{ minWidth: 140 }} />{(search || statusFilter !== 'ALL' || vehicleFilter !== 'ALL') && <Typography.Text type="secondary">{total} kết quả</Typography.Text>}<Button onClick={onExport}>Xuất Excel</Button></Space>;
}
