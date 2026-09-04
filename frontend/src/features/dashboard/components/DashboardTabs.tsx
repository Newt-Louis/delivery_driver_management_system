import type { DispatchData, UnitDispatch } from '../../../lib/types';
import type { TabKey } from '../types';
import { getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';

interface DashboardTab {
  key: TabKey;
  label: string;
  icon: string;
  unitConfig?: UnitDispatch['unitConfig'];
}

interface DashboardTabsProps {
  tabs: DashboardTab[];
  activeTab: TabKey;
  dispatch?: DispatchData;
  totalWaiting: number;
  onChange: (tab: TabKey) => void;
}

export default function DashboardTabs({ tabs, activeTab, dispatch, totalWaiting, onChange }: DashboardTabsProps) {
  return (
    <div className="flex gap-1 mb-5 border-b border-thiso-200 overflow-x-auto">
      {tabs.map((tab) => {
        const waiting = tab.key === 'ALL'
          ? totalWaiting
          : dispatch?.[tab.key]?.insights.stats.waiting ?? 0;
        const meta = tab.key !== 'ALL' ? getUnitMeta(tab.key, tab.unitConfig) : null;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-all -mb-px border border-b-0 whitespace-nowrap
              ${isActive
                ? (meta ? 'border-thiso-200 bg-white' : 'border-thiso-200 bg-white text-thiso-700')
                : 'border-transparent text-thiso-400 hover:text-thiso-700 hover:bg-thiso-50'}`}
            style={isActive && meta ? meta.tabActiveStyle : undefined}
          >
            {meta ? (
              <UnitBrandMark
                meta={meta}
                className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/70"
                iconClassName="text-base leading-none"
              />
            ) : tab.icon}
            {tab.label}
            {waiting > 0 && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-black ${meta ? '' : 'bg-thiso-200 text-thiso-700'}`}
                style={meta ? meta.badgeStyle : undefined}
              >
                {waiting}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
