import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useRealtimeScope, useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import DockCard from '../components/DockCard';
import type { Slot } from '../lib/types';

const UNIT_ORDER = ['THISKYHALL', 'TENANT', 'EMART'];
const UNIT_LABELS: Record<string, string> = { EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)' };
const UNIT_COLORS: Record<string, string> = { THISKYHALL: 'bg-purple-500', TENANT: 'bg-teal-500', EMART: 'bg-blue-500' };

export default function DockManagement() {
  const queryClient = useQueryClient();
  const socket = useSocket();
  const realtimeScope = useRealtimeScope();
  const { hasRole } = useAuth();
  const canEdit = hasRole('ADMIN', 'RECEIVING');

  const { data: slots = [] } = useQuery<Slot[]>({
    queryKey: ['slots', realtimeScope],
    queryFn: async () => (await api.get('/api/slots', { params: realtimeScope })).data,
  });

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['slots'] });
    socket.on('slot_updated', refresh);
    socket.on('queue_updated', refresh);
    return () => {
      socket.off('slot_updated', refresh);
      socket.off('queue_updated', refresh);
    };
  }, [socket, queryClient]);

  async function handleStatusChange(slotId: string, status: string) {
    await api.patch(`/api/slots/${slotId}/status`, { status });
    queryClient.invalidateQueries({ queryKey: ['slots'] });
  }

  const stats = {
    available: slots.filter((s) => s.status === 'AVAILABLE').length,
    occupied: slots.filter((s) => s.status === 'OCCUPIED').length,
    reserved: slots.filter((s) => s.status === 'RESERVED').length,
    maintenance: slots.filter((s) => s.status === 'MAINTENANCE').length,
    trucks: slots.filter((s) => s.vehicleType === 'TRUCK').length,
    motorbikes: slots.filter((s) => s.vehicleType === 'MOTORBIKE').length,
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Quản lý Slot nhận hàng</h1>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-green-700">{stats.available}</div>
          <div className="text-xs text-green-600 mt-1 font-medium">Trống</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{stats.occupied}</div>
          <div className="text-xs text-red-600 mt-1 font-medium">Đang dùng</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-yellow-700">{stats.reserved}</div>
          <div className="text-xs text-yellow-600 mt-1 font-medium">Đặt trước</div>
        </div>
        <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-gray-600">{stats.maintenance}</div>
          <div className="text-xs text-gray-500 mt-1 font-medium">Bảo trì</div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-700">🚛 {stats.trucks}</div>
          <div className="text-xs text-orange-600 mt-1 font-medium">Slot Xe Tải</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-indigo-700">🛵 {stats.motorbikes}</div>
          <div className="text-xs text-indigo-600 mt-1 font-medium">Slot Xe Máy</div>
        </div>
      </div>

      {/* Slots grouped by unit → then by vehicleType */}
      {UNIT_ORDER.map((unit) => {
        const unitSlots = slots.filter((s) => s.assignedUnit === unit);
        const truckSlots = unitSlots.filter((s) => s.vehicleType === 'TRUCK');
        const motorbikeSlots = unitSlots.filter((s) => s.vehicleType === 'MOTORBIKE');
        const otherSlots = unitSlots.filter((s) => s.vehicleType === 'OTHER');

        return (
          <div key={unit} className="mb-10">
            <h2 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className={`w-2 h-6 rounded-full ${UNIT_COLORS[unit]} inline-block`}></span>
              {UNIT_LABELS[unit]}
              <span className="text-sm font-normal text-gray-400">({unitSlots.length} slots)</span>
            </h2>

            {truckSlots.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                  🚛 Xe Tải <span className="font-normal text-gray-300">({truckSlots.length})</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {truckSlots.map((slot) => (
                    <DockCard key={slot.id} slot={slot} canEdit={canEdit} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )}

            {motorbikeSlots.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1.5">
                  🛵 Xe Máy <span className="font-normal text-gray-300">({motorbikeSlots.length})</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {motorbikeSlots.map((slot) => (
                    <DockCard key={slot.id} slot={slot} canEdit={canEdit} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )}

            {otherSlots.length > 0 && (
              <div className="mb-5">
                <p className="text-xs font-bold text-gray-400 uppercase mb-2">🚗 Khác ({otherSlots.length})</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {otherSlots.map((slot) => (
                    <DockCard key={slot.id} slot={slot} canEdit={canEdit} onStatusChange={handleStatusChange} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-400 inline-block"></span>Trống</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block"></span>Đang dùng</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span>Đặt trước</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-gray-400 inline-block"></span>Bảo trì</span>
      </div>
    </div>
  );
}
