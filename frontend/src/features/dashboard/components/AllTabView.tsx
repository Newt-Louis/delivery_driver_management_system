import type { DeliveryRegistration, DispatchData } from '../../../lib/types';
import type { DeliveryLifecycleAction } from '../types';
import { getAllActiveDeliveries, getAllUpcomingDeliveries, getUnitMeta } from '../utils';
import QueueTable from './QueueTable';
import UpcomingSection from './UpcomingSection';

interface AllTabViewProps {
  dispatch: DispatchData;
  onCall: (delivery: DeliveryRegistration, slotId?: string) => void;
  onAction: (id: string, action: DeliveryLifecycleAction) => void;
  onView: (id: string) => void;
  actionLoading: string | null;
}

export default function AllTabView({ dispatch, onCall, onAction, onView, actionLoading }: AllTabViewProps) {
  const units = Object.keys(dispatch);
  const allActive = getAllActiveDeliveries(dispatch);
  const allUpcoming = getAllUpcomingDeliveries(dispatch);

  return (
    <>
      <div className="grid gap-4 mb-5 md:grid-cols-3">
        {units.map((unit) => {
          const unitDispatch = dispatch[unit];
          const meta = getUnitMeta(unit, unitDispatch?.unitConfig);
          const stats = unitDispatch?.insights.stats;
          return (
            <div key={unit} className={`bg-gradient-to-br ${meta.headerBg} rounded-2xl p-4 text-white shadow-md`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{meta.icon}</span>
                  <span className="font-black text-sm tracking-wide">{meta.label.toUpperCase()}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5 mb-2">
                {[
                  { label: 'Chờ gọi', value: stats?.waiting ?? 0 },
                  { label: 'Đã gọi', value: stats?.called ?? 0 },
                  { label: 'Nhận hàng', value: stats?.receiving ?? 0 },
                ].map((item) => (
                  <div key={item.label} className="bg-white/15 rounded-lg p-2 text-center">
                    <div className="text-xl font-black leading-none">{item.value}</div>
                    <div className="text-xs text-white/70 mt-0.5 leading-tight">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-white/60">
                <span>🚛 {stats?.truckSlotsAvailable ?? stats?.truckDocksAvailable ?? 0} slot tải</span>
                <span>🛵 {stats?.mbSlotsAvailable ?? stats?.mbDocksAvailable ?? 0} slot máy</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <h3 className="text-sm font-black text-thiso-500 uppercase tracking-wider flex items-center gap-2">
          Tất cả xe đang điều phối
          {allActive.length > 0 && (
            <span className="bg-thiso-100 text-thiso-600 text-xs px-2 py-0.5 rounded-full font-bold">{allActive.length}</span>
          )}
        </h3>
      </div>
      <QueueTable deliveries={allActive} onCall={onCall} onAction={onAction} onView={onView} actionLoading={actionLoading} />
      <UpcomingSection deliveries={allUpcoming} />
    </>
  );
}
