import { Badge, Space, Tabs } from 'antd';
import type { DispatchData, UnitDispatch } from '../../../lib/types';
import type { TabKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';
interface DashboardTab { key: TabKey; label: string; icon: string; unitConfig?: UnitDispatch['unitConfig']; }
interface Props { tabs: DashboardTab[]; activeTab: TabKey; dispatch?: DispatchData; totalWaiting: number; onChange: (tab: TabKey) => void; }
export default function DashboardTabs({ tabs, activeTab, dispatch, totalWaiting, onChange }: Props) {
  return <Tabs activeKey={activeTab} onChange={(key) => onChange(key as TabKey)} items={tabs.map((tab) => {
    const waiting = tab.key === 'ALL' ? totalWaiting : dispatch?.[tab.key]?.insights.stats.waiting ?? 0;
    const meta = tab.key !== 'ALL' ? getUnitMeta(tab.key, tab.unitConfig) : null;
    return { key: tab.key, label: <Space>{meta ? <UnitBrandMark meta={meta} className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden" /> : tab.icon} {tab.label} {waiting > 0 && <Badge count={waiting} overflowCount={999} />}</Space> };
  })} />;
}
