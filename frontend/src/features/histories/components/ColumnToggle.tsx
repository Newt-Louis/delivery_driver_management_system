import { Button, Checkbox, Popover, Space } from 'antd';
import type { ColumnConfig } from '../types';
export default function ColumnToggle({ columns, visibleKeys, onChange }: { columns: ColumnConfig[]; visibleKeys: string[]; onChange: (keys: string[]) => void }) {
 return <Popover trigger="click" title="Cột hiển thị" content={<Space direction="vertical" style={{ maxHeight: 320, overflowY: 'auto' }}>{columns.map(col => <Checkbox key={col.key} checked={visibleKeys.includes(col.key)} disabled={visibleKeys.length === 1 && visibleKeys.includes(col.key)} onChange={() => onChange(visibleKeys.includes(col.key) ? visibleKeys.filter(k => k !== col.key) : [...visibleKeys, col.key])}>{col.label}</Checkbox>)}</Space>}><Button>Cột hiển thị</Button></Popover>;
}
