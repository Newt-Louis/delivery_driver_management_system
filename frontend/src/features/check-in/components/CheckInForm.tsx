import { Button, Input, Segmented, Space } from 'antd';
import { CHECK_IN_MODES } from '../constants';
import type { CheckInMode } from '../types';
interface Props { input: string; mode: CheckInMode; loading: boolean; onInputChange: (value: string) => void; onModeChange: (mode: CheckInMode) => void; onSubmit: (event: React.FormEvent) => void }
export default function CheckInForm({ input, mode, loading, onInputChange, onModeChange, onSubmit }: Props) {
  const active = CHECK_IN_MODES.find((item) => item.value === mode) ?? CHECK_IN_MODES[0];
  return <Space orientation="vertical" size="middle" className="w-full">
    <Segmented block size="large" options={CHECK_IN_MODES.map(({ value, label }) => ({ value, label: <span className="text-lg">{label}</span> }))} value={mode} onChange={(value) => onModeChange(value as CheckInMode)} />
    <form onSubmit={onSubmit} className="flex flex-wrap gap-3">
      <Input className="flex-1 min-w-0" size="large" aria-label={active.label} value={input} onChange={(event) => onInputChange(event.target.value)} placeholder={active.placeholder} required autoFocus />
      <Button type="primary" htmlType="submit" size="large" loading={loading} disabled={!input.trim()}>Check-in</Button>
    </form>
  </Space>;
}
