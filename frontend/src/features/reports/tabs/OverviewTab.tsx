import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import { fetchOverview, fetchDailyTrend, fetchHourlyHeatmap } from '../api';
import { STATUS_LABEL, DOW_LABEL } from '../constants';
import { fmt } from '../utils';
import KpiCard from '../components/KpiCard';
import BarRow from '../components/BarRow';
import ExportBtn from '../components/ExportBtn';
import type { Overview, DayTrend, HeatCell } from '../types';

export default function OverviewTab({ from, to, unit }: { from: string; to: string; unit: string }) {
  const params = { from, to, unit };

  const { data: ov, isLoading: ovLoading } = useQuery<Overview>({
    queryKey: ['reports-overview', from, to, unit],
    queryFn: () => fetchOverview(params),
  });
  const { data: trend = [] } = useQuery<DayTrend[]>({
    queryKey: ['reports-trend', from, to, unit],
    queryFn: () => fetchDailyTrend(params),
  });
  const { data: heat = [] } = useQuery<HeatCell[]>({
    queryKey: ['reports-heat', from, to, unit],
    queryFn: () => fetchHourlyHeatmap(params),
  });

  const maxTrend = useMemo(() => Math.max(1, ...trend.map((t) => t.total)), [trend]);
  const maxHeat  = useMemo(() => Math.max(1, ...heat.map((h) => h.count)), [heat]);

  if (ovLoading) return <div className="py-20 text-center text-thiso-400">Đang tải...</div>;
  if (!ov) return null;

  function exportOverview() {
    if (!ov) return;
    downloadCsv('bao-cao-tong-quan', ['Chỉ số', 'Giá trị'], [
      ['Tổng lượt giao hàng', ov.total],
      ['Hoàn tất', ov.completed],
      ['Đã hủy', ov.cancelled],
      ['Tỷ lệ hoàn tất (%)', ov.completionRate],
      ['Tỷ lệ hủy (%)', ov.cancellationRate],
      ['TB chờ được gọi (phút)', ov.avgWaitMinutes],
      ['TB thời gian nhận (phút)', ov.avgReceivingMinutes],
      ...Object.entries(ov.byStatus).map(([k, v]) => [`Trạng thái: ${k}`, v]),
    ]);
  }
  function exportTrend() {
    downloadCsv('xu-huong-theo-ngay', ['Ngày', 'Tổng', 'Hoàn tất'],
      trend.map((t) => [t.day, t.total, t.completed]));
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2 mb-1">
        <ExportBtn onClick={exportOverview} label="Xuất KPI" />
        <ExportBtn onClick={exportTrend} label="Xuất xu hướng" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Tổng lượt giao hàng" value={ov.total.toLocaleString()} />
        <KpiCard label="Hoàn tất" value={`${ov.completionRate}%`} sub={`${ov.completed} lượt`} color="text-green-600" />
        <KpiCard label="TB chờ được gọi" value={fmt(ov.avgWaitMinutes, ' phút')} sub="từ check-in → gọi" />
        <KpiCard label="TB thời gian nhận" value={fmt(ov.avgReceivingMinutes, ' phút')} sub="từ bắt đầu → hoàn tất" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Phân bổ theo trạng thái</h3>
          {Object.entries(ov.byStatus).sort((a, b) => b[1] - a[1]).map(([st, cnt]) => (
            <BarRow key={st} label={STATUS_LABEL[st] ?? st} value={cnt} max={ov.total} color="bg-sky-500" />
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Xu hướng theo ngày</h3>
          {trend.length === 0 && <div className="text-sm text-thiso-400 py-8 text-center">Không có dữ liệu</div>}
          <div className="flex items-end gap-0.5 h-32 overflow-x-auto">
            {trend.map((t) => {
              const totalH = Math.max(1, Math.round((t.total / maxTrend) * 100));
              const compH  = Math.round((t.completed / maxTrend) * 100);
              return (
                <div key={t.day} className="flex flex-col items-center gap-0.5 flex-1 min-w-[14px] group relative">
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-thiso-800 text-white text-[10px] px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {t.day}: {t.total} ({t.completed} HT)
                  </div>
                  <div className="w-full flex flex-col-reverse" style={{ height: `${totalH}%` }}>
                    <div className="w-full rounded-t-sm bg-sky-200" style={{ height: '100%' }}>
                      <div className="w-full rounded-t-sm bg-sky-500" style={{ height: `${totalH > 0 ? compH / totalH * 100 : 0}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-thiso-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" /> Hoàn tất</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-sky-200 inline-block" /> Tổng</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
        <h3 className="font-bold text-thiso-700 mb-1">Bản đồ nhiệt — giờ check-in</h3>
        <p className="text-xs text-thiso-400 mb-4">Màu đậm hơn = đông hơn. Dùng để xác định giờ cao điểm và bố trí nhân lực.</p>
        <div className="overflow-x-auto">
          <table className="text-[11px] border-separate border-spacing-0.5">
            <thead>
              <tr>
                <th className="text-thiso-400 font-normal w-8 text-right pr-1" />
                {DOW_LABEL.map((d) => <th key={d} className="text-thiso-500 font-bold w-9 text-center">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 16 }, (_, i) => i + 4).map((hour) => (
                <tr key={hour}>
                  <td className="text-thiso-400 text-right pr-1">{String(hour).padStart(2, '0')}h</td>
                  {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                    const cell = heat.find((h) => h.hour === hour && h.dow === dow);
                    const intensity = cell ? cell.count / maxHeat : 0;
                    const bg = intensity > 0.7 ? '#1E3A5C' : intensity > 0.4 ? '#2B5F9E' : intensity > 0.1 ? '#93C5FD' : intensity > 0 ? '#DBEAFE' : '#F8FAFC';
                    const fg = intensity > 0.4 ? 'white' : '#64748B';
                    return (
                      <td key={dow} className="rounded w-9 h-7 text-center font-bold" style={{ background: bg, color: fg }}>
                        {cell ? cell.count : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
