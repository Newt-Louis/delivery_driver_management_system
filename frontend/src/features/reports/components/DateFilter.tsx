import { Button, DatePicker, Select, Space } from 'antd';
import dayjs from 'dayjs';
import type { UnitConfig } from '../../../lib/types';
import { defaultTo } from '../utils';
export default function DateFilter({ from, to, unit, units, onFrom, onTo, onUnit }: { from: string; to: string; unit: string; units: UnitConfig[]; onFrom: (v: string) => void; onTo: (v: string) => void; onUnit: (v: string) => void }) {
 return <Space wrap className="mb-5"><DatePicker aria-label="Từ ngày" value={from ? dayjs(from) : null} onChange={d => onFrom(d ? d.format('YYYY-MM-DD') : '')} /><DatePicker aria-label="Đến ngày" value={to ? dayjs(to) : null} onChange={d => onTo(d ? d.format('YYYY-MM-DD') : '')} /><Select aria-label="Đơn vị" value={unit} onChange={onUnit} style={{ minWidth: 180 }} options={[{ value: '', label: 'Tất cả đơn vị' }, ...units.map(u => ({ value: u.unit, label: u.shortName || u.displayName || u.unit }))]} />{[7, 30, 90].map(d => <Button key={d} onClick={() => { onFrom(new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10)); onTo(defaultTo()); }}>{d} ngày</Button>)}</Space>;
}
