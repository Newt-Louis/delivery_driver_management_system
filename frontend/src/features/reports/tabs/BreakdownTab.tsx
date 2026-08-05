import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import { fetchBreakdown } from '../api';
import { GOODS_LABEL, VEHICLE_LABEL } from '../constants';
import { unitLabel } from '../utils';
import BarRow from '../components/BarRow';
import ExportBtn from '../components/ExportBtn';
import type { Breakdown } from '../types';

export default function BreakdownTab({ from, to, unit, unitLabels }: {
  from: string; to: string; unit: string; unitLabels: Record<string, string>;
}) {
  const { data, isLoading } = useQuery<Breakdown>({
    queryKey: ['reports-breakdown', from, to, unit],
    queryFn: () => fetchBreakdown({ from, to, unit }),
  });

  if (isLoading) return <div className="py-20 text-center text-thiso-400">Đang tải...</div>;
  if (!data) return null;

  const maxGoods = Math.max(1, ...data.byGoods.map((r) => r.count));
  const maxVeh   = Math.max(1, ...data.byVehicle.map((r) => r.count));
  const maxUnit  = Math.max(1, ...data.byUnit.map((r) => r.count));
  const colors   = ['bg-sky-500', 'bg-indigo-500', 'bg-amber-500', 'bg-rose-500', 'bg-emerald-500'];

  function exportBreakdown() {
    downloadCsv('phan-tich-giao-hang', ['Nhóm', 'Loại', 'Số lượt'], [
      ...data!.byGoods.map((r)   => ['Loại hàng', GOODS_LABEL[r.key]   ?? r.key, r.count]),
      ...data!.byVehicle.map((r) => ['Loại xe',   VEHICLE_LABEL[r.key] ?? r.key, r.count]),
      ...data!.byUnit.map((r)    => ['Đơn vị',    unitLabel(unitLabels, r.key),   r.count]),
    ]);
  }

  return (
    <div>
      <div className="flex justify-end mb-3"><ExportBtn onClick={exportBreakdown} /></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Theo loại hàng hóa</h3>
          {data.byGoods.map((r, i) => (
            <BarRow key={r.key} label={GOODS_LABEL[r.key] ?? r.key} value={r.count} max={maxGoods} color={colors[i % colors.length]} />
          ))}
          {data.byGoods.length === 0 && <p className="text-sm text-thiso-400">Không có dữ liệu</p>}
        </div>
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Theo loại phương tiện</h3>
          {data.byVehicle.map((r, i) => (
            <BarRow key={r.key} label={VEHICLE_LABEL[r.key] ?? r.key} value={r.count} max={maxVeh} color={colors[i % colors.length]} />
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <h3 className="font-bold text-thiso-700 mb-4">Theo đơn vị nhận hàng</h3>
          {data.byUnit.map((r, i) => (
            <BarRow key={r.key} label={unitLabel(unitLabels, r.key)} value={r.count} max={maxUnit} color={colors[i % colors.length]} />
          ))}
        </div>
      </div>
    </div>
  );
}
