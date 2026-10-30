import { Badge, Space, Tabs } from 'antd';
import { useEffect, useRef } from 'react';
import type { DispatchData, UnitDispatch } from '../../../lib/types';
import type { TabKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';
interface DashboardTab { key: TabKey; label: string; unitConfig?: UnitDispatch['unitConfig']; }
interface Props { tabs: DashboardTab[]; activeTab?: TabKey; dispatch?: DispatchData; totalActive: number; onChange: (tab: TabKey) => void; }
export default function DashboardTabs({ tabs, activeTab, dispatch, totalActive, onChange }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.classList.add('dashboard-scroll-scope');
    return () => document.documentElement.classList.remove('dashboard-scroll-scope');
  }, []);

  useEffect(() => {
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const nav = tabsRef.current?.querySelector<HTMLElement>('.ant-tabs-nav-wrap');
    const selected = nav?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!nav || !selected) return;
    const navRect = nav.getBoundingClientRect();
    const tabRect = selected.getBoundingClientRect();
    if (tabRect.left < navRect.left) nav.scrollLeft -= navRect.left - tabRect.left;
    else if (tabRect.right > navRect.right) nav.scrollLeft += tabRect.right - navRect.right;
  }, [activeTab, tabs.length]);

  return <div ref={tabsRef}><Tabs className="dashboard-unit-tabs" activeKey={activeTab} onChange={(key) => onChange(key as TabKey)} items={tabs.map((tab) => {
    const activeCount = tab.key === 'ALL' ? totalActive : dispatch?.[tab.key]?.active.length ?? 0;
    const meta = tab.key !== 'ALL' ? getUnitMeta(tab.key, tab.unitConfig) : null;
    return { key: tab.key, label: <Space>{meta && <UnitBrandMark meta={meta} className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden" />}{tab.label} {activeCount > 0 && <Badge count={activeCount} overflowCount={999} />}</Space> };
  })} /></div>;
}
