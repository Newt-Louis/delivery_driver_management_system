import { useReports } from '../features/reports/hooks/useReports';
import { REPORT_TABS } from '../features/reports/constants';
import DateFilter from '../features/reports/components/DateFilter';
import OverviewTab from '../features/reports/tabs/OverviewTab';
import BreakdownTab from '../features/reports/tabs/BreakdownTab';
import SlotTab from '../features/reports/tabs/SlotTab';
import AiTab from '../features/reports/tabs/AiTab';

export default function Reports() {
  const { tab, setTab, from, setFrom, to, setTo, unit, setUnit, units, unitLabels } = useReports();

  return (
    <div className="min-h-screen bg-thiso-50/50 p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-thiso-800">Báo cáo & Phân tích</h1>
          <p className="text-sm text-thiso-500 mt-0.5">Dữ liệu thực tế · Dành cho ban lãnh đạo</p>
        </div>

        <DateFilter
          from={from} to={to} unit={unit} units={units}
          onFrom={setFrom} onTo={setTo} onUnit={setUnit}
        />

        <div className="flex gap-1 mb-6 bg-white border border-thiso-100 rounded-2xl p-1.5 w-fit shadow-sm flex-wrap">
          {REPORT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-thiso-800 text-white shadow-sm'
                  : 'text-thiso-500 hover:text-thiso-700 hover:bg-thiso-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview'  && <OverviewTab  from={from} to={to} unit={unit} />}
        {tab === 'breakdown' && <BreakdownTab from={from} to={to} unit={unit} unitLabels={unitLabels} />}
        {tab === 'slots'     && <SlotTab      from={from} to={to} unit={unit} unitLabels={unitLabels} />}
        {tab === 'ai'        && <AiTab        from={from} to={to} unit={unit} unitLabels={unitLabels} />}
      </div>
    </div>
  );
}
