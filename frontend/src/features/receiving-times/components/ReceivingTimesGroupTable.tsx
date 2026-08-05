import type { ReceivingTimeConfig } from '../../../lib/types';
import { CONF_LABEL, GOODS_LABEL, VT_LABEL } from '../constants';
import { groupReceivingTimeConfigs } from '../utils';

type UnitGroup = ReturnType<typeof groupReceivingTimeConfigs>[number];

interface ReceivingTimesGroupTableProps {
  group: UnitGroup;
  canManageConfig: boolean;
  acceptingId: string | null;
  onAcceptOne: (id: string) => void;
}

function ReceivingTimeRow({
  config,
  canManageConfig,
  acceptingId,
  onAcceptOne,
}: {
  config: ReceivingTimeConfig;
  canManageConfig: boolean;
  acceptingId: string | null;
  onAcceptOne: (id: string) => void;
}) {
  const confidence = CONF_LABEL[config.confidence];
  const isAccepting = acceptingId === config.id;
  const canAccept = config.recommendedMinutes !== null && config.shouldUpdate;

  return (
    <tr className={`transition-colors ${config.shouldUpdate ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-thiso-50/60'}`}>
      <td className="px-4 py-3 font-medium whitespace-nowrap">
        {VT_LABEL[config.vehicleType] ?? config.vehicleType}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {GOODS_LABEL[config.goodsType] ?? config.goodsType}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="font-black text-thiso-800 text-base">{config.configuredMinutes}</span>
        <span className="text-xs text-thiso-400 ml-1">phút</span>
      </td>
      <td className="px-4 py-3 text-center">
        {config.liveAvgMinutes !== null ? (
          <div>
            <span className={`font-black text-base ${config.shouldUpdate ? 'text-sky-700' : 'text-thiso-600'}`}>
              {config.liveAvgMinutes}
            </span>
            <span className="text-xs text-thiso-400 ml-1">phút</span>
          </div>
        ) : (
          <span className="text-thiso-300 text-xs">Chưa có dữ liệu</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className="font-mono text-thiso-600">{config.liveSampleCount}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${confidence.color}`}>
          {confidence.text}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        {config.diffMinutes !== null ? (
          <span className={`text-sm font-bold ${
            config.diffMinutes > 2 ? 'text-red-600'
              : config.diffMinutes < -2 ? 'text-green-600'
                : 'text-thiso-400'
          }`}>
            {config.diffMinutes > 0 ? '+' : ''}{config.diffMinutes} phút
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3">
        {canManageConfig && canAccept ? (
          <button
            type="button"
            onClick={() => onAcceptOne(config.id)}
            disabled={isAccepting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            <span>{isAccepting ? '⏳' : '✅'}</span>
            {isAccepting ? 'Đang lưu...' : `Chấp nhận ${config.liveAvgMinutes}'`}
          </button>
        ) : config.recommendedMinutes !== null && !config.shouldUpdate ? (
          <span className="text-xs text-green-600 font-medium">✓ Đã tối ưu</span>
        ) : !canManageConfig && canAccept ? (
          <span className="text-xs text-amber-600 font-medium">Chờ ADMIN_LOC áp dụng</span>
        ) : (
          <span className="text-xs text-thiso-300">Chạy phân tích trước</span>
        )}
      </td>
    </tr>
  );
}

export default function ReceivingTimesGroupTable({
  group,
  canManageConfig,
  acceptingId,
  onAcceptOne,
}: ReceivingTimesGroupTableProps) {
  const unitPending = group.items.filter((config) => config.shouldUpdate).length;

  return (
    <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
      <div
        className="px-5 py-4 flex items-center gap-3 border-b border-thiso-100"
        style={{ background: `${group.meta.color}12` }}
      >
        {group.meta.logoUrl ? <img src={group.meta.logoUrl} alt="" className="w-7 h-7 object-contain rounded" /> : <span className="text-xl">{group.meta.icon}</span>}
        <span className="font-black text-base" style={{ color: group.meta.color }}>{group.meta.label}</span>
        {unitPending > 0 && (
          <span className="ml-auto text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
            {unitPending} chờ chấp nhận
          </span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase text-left border-b border-thiso-100">
              <th className="px-4 py-2.5">Loại xe</th>
              <th className="px-4 py-2.5">Loại hàng</th>
              <th className="px-4 py-2.5 text-center">Cấu hình hiện tại</th>
              <th className="px-4 py-2.5 text-center">AI Khuyến nghị</th>
              <th className="px-4 py-2.5 text-center">Số mẫu</th>
              <th className="px-4 py-2.5 text-center">Độ tin cậy</th>
              <th className="px-4 py-2.5 text-center">Chênh lệch</th>
              <th className="px-4 py-2.5">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-thiso-50">
            {group.items.map((config) => (
              <ReceivingTimeRow
                key={config.id}
                config={config}
                canManageConfig={canManageConfig}
                acceptingId={acceptingId}
                onAcceptOne={onAcceptOne}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
