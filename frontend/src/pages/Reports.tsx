import { Tabs, Typography } from 'antd';
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
    <div className="p-4 md:p-6">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-6">
          <Typography.Title level={2}>Báo cáo &amp; Phân tích</Typography.Title>
          <Typography.Text type="secondary">Dữ liệu thực tế · Dành cho ban lãnh đạo</Typography.Text>
        </div>

        <DateFilter
          from={from} to={to} unit={unit} units={units}
          onFrom={setFrom} onTo={setTo} onUnit={setUnit}
        />

        <Tabs activeKey={tab} onChange={(key) => setTab(key as typeof tab)} items={REPORT_TABS.map(t => ({ key: t.id, label: t.label }))} />

        {tab === 'overview'  && <OverviewTab  from={from} to={to} unit={unit} />}
        {tab === 'breakdown' && <BreakdownTab from={from} to={to} unit={unit} unitLabels={unitLabels} />}
        {tab === 'slots'     && <SlotTab      from={from} to={to} unit={unit} unitLabels={unitLabels} />}
        {tab === 'ai'        && <AiTab        from={from} to={to} unit={unit} unitLabels={unitLabels} />}
      </div>
    </div>
  );
}
