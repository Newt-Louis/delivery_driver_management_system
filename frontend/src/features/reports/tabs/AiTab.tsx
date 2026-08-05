import { useQuery } from '@tanstack/react-query';
import { downloadCsv } from '../../../lib/export';
import { fetchAiRecommendations } from '../api';
import { VEHICLE_LABEL, SUGGEST_META, PRIORITY_META } from '../constants';
import { unitLabel } from '../utils';
import UtilBar from '../components/UtilBar';
import ExportBtn from '../components/ExportBtn';
import type { AiReport } from '../types';

const SUGGEST_LABEL: Record<string, string> = {
  ADD_SLOT: 'Thêm slot', REDUCE_SLOT: 'Giảm slot',
  CONVERT_TO_MOTORBIKE: 'Chuyển xe máy', CONVERT_TO_TRUCK: 'Chuyển xe tải', OPTIMAL: 'Tối ưu',
};
const PRIORITY_LABEL: Record<string, string> = { HIGH: 'Cao', MEDIUM: 'Trung bình', LOW: 'Thấp' };

export default function AiTab({ from, to, unit, unitLabels }: {
  from: string; to: string; unit: string; unitLabels: Record<string, string>;
}) {
  const { data, isLoading } = useQuery<AiReport>({
    queryKey: ['reports-ai', from, to, unit],
    queryFn: () => fetchAiRecommendations({ from, to, unit }),
  });

  if (isLoading) return (
    <div className="py-20 text-center">
      <div className="text-3xl mb-3">🤖</div>
      <div className="text-thiso-400">Đang phân tích dữ liệu...</div>
    </div>
  );
  if (!data) return null;

  const scoreColor = data.healthScore >= 75 ? 'text-green-600' : data.healthScore >= 50 ? 'text-amber-600' : 'text-red-600';
  const highs = data.recommendations.filter((r) => r.priority === 'HIGH');
  const meds  = data.recommendations.filter((r) => r.priority === 'MEDIUM');
  const lows  = data.recommendations.filter((r) => r.priority === 'LOW');

  function exportAi() {
    downloadCsv('ai-de-xuat-slot',
      ['Đơn vị', 'Loại xe', 'Số slot', 'Utilization (%)', 'Đề xuất', 'Ưu tiên', 'Tồn đọng', 'Lý do', 'Hành động'],
      data!.recommendations.map((r) => [
        unitLabel(unitLabels, r.unit), VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType,
        r.currentSlots, r.avgUtilization, SUGGEST_LABEL[r.suggestion] ?? r.suggestion,
        PRIORITY_LABEL[r.priority] ?? r.priority, r.backlogNow, r.reason, r.action,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end"><ExportBtn onClick={exportAi} label="Xuất đề xuất AI" /></div>

      {/* Health summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm text-center">
          <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-2">Điểm sức khỏe vận hành</div>
          <div className={`text-5xl font-black ${scoreColor}`}>{data.healthScore}</div>
          <div className="text-xs text-thiso-400 mt-1">/100</div>
          <div className="mt-3 text-sm text-thiso-600">
            {data.healthScore >= 75 ? '✅ Vận hành hiệu quả' : data.healthScore >= 50 ? '⚠️ Cần cải thiện' : '🚨 Cần hành động ngay'}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm text-center">
          <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-2">TB Utilization toàn hệ thống</div>
          <div className={`text-5xl font-black ${data.avgUtilization >= 85 ? 'text-red-600' : data.avgUtilization >= 30 ? 'text-green-600' : 'text-amber-600'}`}>{data.avgUtilization}%</div>
          <div className="text-xs text-thiso-400 mt-1">mức sử dụng trung bình</div>
          <div className="mt-3 text-sm text-thiso-600">Phân tích {data.periodDays} ngày gần nhất</div>
        </div>
        <div className="bg-white rounded-2xl border border-thiso-100 p-5 shadow-sm">
          <div className="text-xs font-bold text-thiso-400 uppercase tracking-wider mb-3">Tóm tắt đề xuất</div>
          <div className="space-y-2">
            {highs.length > 0 && <div className="flex items-center justify-between text-sm"><span className="text-red-600 font-bold">🚨 Ưu tiên cao</span><span className="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full text-xs">{highs.length}</span></div>}
            {meds.length > 0  && <div className="flex items-center justify-between text-sm"><span className="text-amber-600 font-bold">⚠️ Trung bình</span><span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full text-xs">{meds.length}</span></div>}
            {lows.length > 0  && <div className="flex items-center justify-between text-sm"><span className="text-thiso-500">✅ Tối ưu</span><span className="bg-thiso-100 text-thiso-600 font-bold px-2 py-0.5 rounded-full text-xs">{lows.length}</span></div>}
          </div>
          <div className="mt-3 text-[11px] text-thiso-400">Cập nhật: {new Date(data.analyzedAt).toLocaleString('vi-VN')}</div>
        </div>
      </div>

      {/* Action recommendations */}
      {data.recommendations.filter((r) => r.suggestion !== 'OPTIMAL').length > 0 && (
        <div>
          <h3 className="font-bold text-thiso-700 mb-3">🎯 Đề xuất hành động</h3>
          <div className="space-y-3">
            {data.recommendations.filter((r) => r.suggestion !== 'OPTIMAL').map((r, i) => {
              const sm = SUGGEST_META[r.suggestion];
              const pm = PRIORITY_META[r.priority];
              return (
                <div key={i} className={`rounded-2xl border p-5 ${r.priority === 'HIGH' ? 'border-red-200 bg-red-50' : r.priority === 'MEDIUM' ? 'border-amber-200 bg-amber-50' : 'border-thiso-100 bg-white'}`}>
                  <div className="flex flex-wrap items-start gap-3 mb-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${sm.bg} ${sm.text}`}>{sm.icon} {sm.label}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pm.color}`}>{pm.label}</span>
                    <span className="text-sm font-bold text-thiso-800">{unitLabel(unitLabels, r.unit)} · {VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType}</span>
                    <span className="text-xs text-thiso-400 ml-auto">{r.currentSlots} slot hiện tại · {r.avgUtilization}% utilization</span>
                  </div>
                  <div className="text-sm text-thiso-700 mb-2"><span className="font-semibold">Phân tích:</span> {r.reason}</div>
                  <div className="text-sm text-thiso-800 bg-white/60 rounded-xl px-3 py-2"><span className="font-semibold">💡 Đề xuất:</span> {r.action}</div>
                  {(r.backlogNow > 0 || r.peakHour != null) && (
                    <div className="flex gap-4 mt-2 text-xs text-thiso-500">
                      {r.backlogNow > 0 && <span>⏳ Tồn đọng hiện tại: <strong>{r.backlogNow} xe</strong></span>}
                      {r.peakHour != null && <span>🕐 Giờ cao điểm: <strong>{r.peakHour}:00–{r.peakHour + 1}:00</strong></span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Optimal slots */}
      {data.recommendations.filter((r) => r.suggestion === 'OPTIMAL').length > 0 && (
        <div>
          <h3 className="font-bold text-thiso-700 mb-3">✅ Cấu hình slot đang tối ưu</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.recommendations.filter((r) => r.suggestion === 'OPTIMAL').map((r, i) => (
              <div key={i} className="bg-white border border-thiso-100 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-thiso-700 text-sm">{unitLabel(unitLabels, r.unit)}</span>
                  <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{r.avgUtilization}%</span>
                </div>
                <div className="text-xs text-thiso-500">{VEHICLE_LABEL[r.vehicleType] ?? r.vehicleType} · {r.currentSlots} slot</div>
                <UtilBar pct={r.avgUtilization} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expansion advisory */}
      <div className="bg-gradient-to-br from-thiso-800 to-thiso-700 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="text-4xl">🏗️</div>
          <div>
            <h3 className="font-black text-lg mb-2">Đề xuất mở rộng / Trung tâm mới</h3>
            <p className="text-thiso-300 text-sm leading-relaxed mb-3">
              Dựa trên dữ liệu {data.periodDays} ngày qua: utilization trung bình toàn hệ thống đạt{' '}
              <strong className="text-white">{data.avgUtilization}%</strong>.{' '}
              {data.avgUtilization >= 70
                ? 'Hệ thống đang hoạt động gần ngưỡng tối đa. Nếu xu hướng tăng trưởng duy trì, nên lên kế hoạch mở rộng khu vực nhận hàng hoặc nghiên cứu điểm phân phối thứ hai trong 6–12 tháng tới.'
                : data.avgUtilization >= 50
                  ? 'Hệ thống đang vận hành trong vùng ổn định. Có thể hấp thụ thêm 20–30% lưu lượng trước khi cần đầu tư mở rộng.'
                  : 'Công suất hiện tại còn nhiều dư địa. Tập trung tối ưu hóa quy trình vận hành trước khi cân nhắc mở rộng cơ sở hạ tầng.'}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Slots đang dùng', value: data.recommendations.reduce((s, r) => s + r.currentSlots, 0) },
                { label: 'Cần thêm slot',   value: data.recommendations.filter((r) => r.suggestion === 'ADD_SLOT').length },
                { label: 'Điểm sức khỏe',  value: `${data.healthScore}/100` },
              ].map((c) => (
                <div key={c.label} className="bg-white/10 rounded-xl p-3">
                  <div className="text-xl font-black">{c.value}</div>
                  <div className="text-[11px] text-thiso-300 mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
