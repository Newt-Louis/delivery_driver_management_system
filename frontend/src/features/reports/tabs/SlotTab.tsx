import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import { fetchSlotPerformance } from '../api';
import { VEHICLE_LABEL } from '../constants';
import { fmt, unitLabel } from '../utils';
import UtilBar from '../components/UtilBar';
import ExportBtn from '../components/ExportBtn';
import type { SlotPerf } from '../types';

export default function SlotTab({ from, to, unit, unitLabels }: {
  from: string; to: string; unit: string; unitLabels: Record<string, string>;
}) {
  const { data = [], isLoading } = useQuery<SlotPerf[]>({
    queryKey: ['reports-slots', from, to, unit],
    queryFn: () => fetchSlotPerformance({ from, to, unit }),
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SlotPerf[]>();
    for (const s of data) {
      const g = map.get(s.assignedUnit) ?? [];
      g.push(s);
      map.set(s.assignedUnit, g);
    }
    return map;
  }, [data]);

  if (isLoading) return <div className="py-20 text-center text-thiso-400">Đang tải...</div>;

  function exportSlots() {
    downloadCsv('hieu-suat-slot',
      ['Slot', 'Tên slot', 'Đơn vị', 'Loại xe', 'Tổng lượt', 'Hoàn tất', 'Tỷ lệ HT (%)', 'TB nhận (phút)', 'Min (phút)', 'Max (phút)', 'Utilization (%)'],
      data.map((s) => [s.slotCode, s.slotName, unitLabel(unitLabels, s.assignedUnit),
        VEHICLE_LABEL[s.vehicleType] ?? s.vehicleType, s.totalDeliveries, s.completedDeliveries,
        s.completionRate, s.avgReceivingMinutes ?? '', s.minReceivingMinutes ?? '', s.maxReceivingMinutes ?? '',
        s.utilizationPct]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><ExportBtn onClick={exportSlots} /></div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
        <strong>Hướng dẫn đọc báo cáo:</strong> Utilization = tổng phút thực tế nhận hàng ÷ (số ngày × 15h/ngày).
        Vùng xanh (30–65%): tối ưu. Đỏ (≥85%): cần thêm slot. Xám (&lt;25%): xem xét thu hẹp.
      </div>

      {[...grouped.entries()].map(([unitKey, slots]) => (
        <div key={unitKey}>
          <h3 className="font-bold text-thiso-700 mb-3">{unitLabel(unitLabels, unitKey)}</h3>
          <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                    <th className="px-4 py-3">Slot</th>
                    <th className="px-4 py-3">Loại xe</th>
                    <th className="px-4 py-3 text-right">Tổng lượt</th>
                    <th className="px-4 py-3 text-right">Hoàn tất</th>
                    <th className="px-4 py-3 text-right">TB nhận (phút)</th>
                    <th className="px-4 py-3 text-right">Min / Max</th>
                    <th className="px-4 py-3 min-w-[160px]">Utilization</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((s) => (
                    <tr key={s.slotId} className="border-b border-thiso-50 last:border-0 hover:bg-thiso-50/40">
                      <td className="px-4 py-3">
                        <div className="font-bold font-mono text-thiso-800">{s.slotCode}</div>
                        <div className="text-[11px] text-thiso-400">{s.slotName}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-thiso-600">{VEHICLE_LABEL[s.vehicleType] ?? s.vehicleType}</td>
                      <td className="px-4 py-3 text-right font-bold text-thiso-800">{s.totalDeliveries}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs font-bold text-green-600">{s.completedDeliveries}</span>
                        <span className="text-xs text-thiso-400 ml-1">({s.completionRate}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right text-thiso-700">{fmt(s.avgReceivingMinutes)}</td>
                      <td className="px-4 py-3 text-right text-xs text-thiso-500">{fmt(s.minReceivingMinutes)} / {fmt(s.maxReceivingMinutes)}</td>
                      <td className="px-4 py-3"><UtilBar pct={s.utilizationPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <div className="py-16 text-center text-thiso-400">Chưa có dữ liệu slot</div>}
    </div>
  );
}
