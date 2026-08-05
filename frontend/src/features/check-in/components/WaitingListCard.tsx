import GoodsBadge from '../../../components/GoodsBadge';
import type { DeliveryRegistration } from '../../../lib/types';
import { getTicketCode, getUnitMeta, getWaitingMinutes } from '../utils';
import UnitBadge from './UnitBadge';

interface WaitingListCardProps {
  waitingList: DeliveryRegistration[];
  onExport: () => void;
}

export default function WaitingListCard({ waitingList, onExport }: WaitingListCardProps) {
  if (waitingList.length === 0) return null;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-thiso-700">Xe đang chờ trong sân</h2>
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{waitingList.length} xe</span>
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors"
          >
            ⬇ Xuất Excel
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-thiso-100 text-left">
              <th className="pb-2 pr-3 section-heading">Số thẻ</th>
              <th className="pb-2 pr-3 section-heading">Biển số · Tài xế</th>
              <th className="pb-2 pr-3 section-heading">Mã ĐK</th>
              <th className="pb-2 pr-3 section-heading">Đơn vị</th>
              <th className="pb-2 pr-3 section-heading">Loại hàng</th>
              <th className="pb-2 section-heading">Chờ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-thiso-50">
            {waitingList.map((delivery) => (
              <tr key={delivery.id} className="hover:bg-thiso-50 transition-colors">
                <td className="py-2.5 pr-3">
                  {delivery.ticketNumber != null ? (
                    <span
                      className="font-mono font-black text-white text-xs px-2 py-1 rounded-lg"
                      style={{ background: getUnitMeta(delivery).color }}
                    >
                      {getTicketCode(delivery)}
                    </span>
                  ) : <span className="text-thiso-300 text-xs">—</span>}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="font-mono font-bold text-thiso-800 text-sm">{delivery.vehiclePlate}</div>
                  <div className="text-thiso-400 text-xs">{delivery.driverName}</div>
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs text-thiso-500">{delivery.registrationCode}</td>
                <td className="py-2.5 pr-3">
                  <UnitBadge delivery={delivery} />
                </td>
                <td className="py-2.5 pr-3"><GoodsBadge type={delivery.goodsType} /></td>
                <td className="py-2.5 text-thiso-500 text-xs whitespace-nowrap">
                  {getWaitingMinutes(delivery) != null ? `${getWaitingMinutes(delivery)} phút` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
