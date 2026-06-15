import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { downloadCsv } from '../lib/export';
import type { ReceivingTimeConfig } from '../lib/types';

const UNIT_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  EMART:      { label: 'Emart',            icon: '🏬', color: 'text-emart-700',  bg: 'bg-emart-50'  },
  THISKYHALL: { label: 'Thiskyhall',        icon: '🏢', color: 'text-sky-700',    bg: 'bg-sky-50'    },
  TENANT:     { label: 'Mall (Khách thuê)', icon: '🏪', color: 'text-thiso-700',  bg: 'bg-thiso-50'  },
};
const VT_LABEL: Record<string, string>    = { TRUCK: '🚛 Xe Tải', MOTORBIKE: '🛵 Xe Máy', OTHER: '🚗 Khác' };
const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD:    '🥦 Tươi sống',
  GENERAL_GOODS: '📦 Hàng thường',
  AUTO_WAREHOUSE:'🤖 Kho tự động',
  THI_CONG:      '🔨 Thi công',
};
const CONF_LABEL: Record<string, { text: string; color: string }> = {
  high:   { text: 'Cao',    color: 'bg-green-100 text-green-700' },
  medium: { text: 'Vừa',   color: 'bg-amber-100 text-amber-700' },
  low:    { text: 'Thấp',  color: 'bg-thiso-100 text-thiso-400' },
};

interface AnalyticsData {
  configs: ReceivingTimeConfig[];
  totalCompleted: number;
}

export default function ReceivingTimes() {
  const qc = useQueryClient();
  const [analyzing, setAnalyzing]     = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [msg, setMsg]                 = useState<{ text: string; ok: boolean } | null>(null);

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', 'receiving-times'],
    queryFn: async () => (await api.get('/api/analytics/receiving-times')).data,
    staleTime: 10_000,
  });

  function flash(text: string, ok: boolean) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const { data: r } = await api.post('/api/analytics/receiving-times/analyze');
      flash(r.message, true);
      qc.invalidateQueries({ queryKey: ['analytics'] });
    } catch {
      flash('Lỗi khi phân tích. Vui lòng thử lại.', false);
    } finally {
      setAnalyzing(false);
    }
  }

  async function acceptOne(id: string) {
    setAcceptingId(id);
    try {
      await api.patch(`/api/analytics/receiving-times/${id}/accept`);
      flash('Đã chấp nhận khuyến nghị', true);
      qc.invalidateQueries({ queryKey: ['analytics'] });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      flash(msg ?? 'Lỗi khi chấp nhận', false);
    } finally {
      setAcceptingId(null);
    }
  }

  async function acceptAll() {
    setAcceptingAll(true);
    try {
      const { data: r } = await api.patch('/api/analytics/receiving-times/accept-all');
      flash(r.message, true);
      qc.invalidateQueries({ queryKey: ['analytics'] });
    } catch {
      flash('Lỗi khi chấp nhận', false);
    } finally {
      setAcceptingAll(false);
    }
  }

  const configs = data?.configs ?? [];
  const pendingCount = configs.filter((c) => c.shouldUpdate).length;
  const unitGroups = ['EMART', 'THISKYHALL', 'TENANT'] as const;

  return (
    <div className="max-w-screen-xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <div className="section-heading mb-1">Cài đặt điều hành</div>
          <h1 className="page-title">📊 Thời gian nhận hàng trung bình</h1>
          <p className="text-sm text-thiso-500 mt-1">
            Hệ thống tự học từ lịch sử để ước tính thời gian chờ cho tài xế
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              <span className={analyzing ? 'animate-spin' : ''}>🔬</span>
              {analyzing ? 'Đang phân tích...' : 'Phân tích lịch sử'}
            </button>
            {pendingCount > 0 && (
              <button
                onClick={acceptAll}
                disabled={acceptingAll}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                ✅ Chấp nhận tất cả ({pendingCount})
              </button>
            )}
            <button
              onClick={() => downloadCsv('thoi-gian-nhan-hang',
                ['Đơn vị', 'Loại xe', 'Loại hàng', 'Cấu hình (phút)', 'AI khuyến nghị (phút)', 'TB thực tế (phút)', 'Số mẫu', 'Độ tin cậy', 'Chênh lệch (phút)'],
                configs.map((c) => [
                  ({ EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall' } as Record<string,string>)[c.unit] ?? c.unit,
                  VT_LABEL[c.vehicleType] ?? c.vehicleType, GOODS_LABEL[c.goodsType] ?? c.goodsType,
                  c.configuredMinutes, c.recommendedMinutes ?? '', c.liveAvgMinutes ?? '',
                  c.liveSampleCount ?? c.sampleCount, c.confidence ?? '',
                  c.diffMinutes != null ? Math.round(c.diffMinutes * 10) / 10 : '',
                ])
              )}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
            >
              ⬇ Xuất Excel
            </button>
          </div>
          {msg && (
            <div className={`text-xs px-3 py-1.5 rounded-full font-semibold ${msg.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {msg.text}
            </div>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Đơn đã phân tích', value: data?.totalCompleted ?? '—', icon: '📦' },
          { label: 'Cấu hình có khuyến nghị', value: configs.filter((c) => c.recommendedMinutes !== null).length, icon: '🤖' },
          { label: 'Chờ chấp nhận', value: pendingCount, icon: '⚠️', alert: pendingCount > 0 },
          { label: 'Đã tối ưu', value: configs.filter((c) => !c.shouldUpdate && c.sampleCount > 0).length, icon: '✅' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-3 text-center ${s.alert ? 'bg-amber-50 border-amber-200' : 'bg-white border-thiso-100'}`}>
            <div className="text-2xl mb-0.5">{s.icon}</div>
            <div className="text-xl font-black text-thiso-800">{s.value}</div>
            <div className="text-xs text-thiso-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* How it works info */}
      <div className="bg-sky-50 border border-sky-100 rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
        <span className="text-2xl shrink-0">💡</span>
        <div className="text-sm text-sky-800">
          <strong>Cách hoạt động:</strong> Hệ thống tính trung bình thời gian từ "Bắt đầu nhận hàng" đến "Hoàn tất" theo từng đơn vị, loại xe và loại hàng.
          Nhấn <strong>Phân tích lịch sử</strong> để cập nhật khuyến nghị AI, sau đó nhấn <strong>Chấp nhận</strong> để áp dụng.
          Giá trị được chấp nhận sẽ dùng để tính <em>ước tính thời gian chờ</em> hiển thị cho tài xế trên trang theo dõi.
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-thiso-400">
          <div className="text-4xl mb-3">⏳</div>Đang tải...
        </div>
      ) : (
        <div className="space-y-6">
          {unitGroups.map((unit) => {
            const unitCfgs = configs.filter((c) => c.unit === unit);
            const meta = UNIT_META[unit];
            if (unitCfgs.length === 0) return null;
            const unitPending = unitCfgs.filter((c) => c.shouldUpdate).length;
            return (
              <div key={unit} className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
                <div className={`px-5 py-4 flex items-center gap-3 border-b border-thiso-100 ${meta.bg}`}>
                  <span className="text-xl">{meta.icon}</span>
                  <span className={`font-black text-base ${meta.color}`}>{meta.label}</span>
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
                      {unitCfgs.map((cfg) => {
                        const conf = CONF_LABEL[cfg.confidence];
                        const isAccepting = acceptingId === cfg.id;
                        const canAccept = cfg.recommendedMinutes !== null && cfg.shouldUpdate;
                        return (
                          <tr
                            key={cfg.id}
                            className={`transition-colors ${cfg.shouldUpdate ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-thiso-50/60'}`}
                          >
                            <td className="px-4 py-3 font-medium whitespace-nowrap">
                              {VT_LABEL[cfg.vehicleType] ?? cfg.vehicleType}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {GOODS_LABEL[cfg.goodsType] ?? cfg.goodsType}
                            </td>
                            {/* Current configured */}
                            <td className="px-4 py-3 text-center">
                              <span className="font-black text-thiso-800 text-base">{cfg.configuredMinutes}</span>
                              <span className="text-xs text-thiso-400 ml-1">phút</span>
                            </td>
                            {/* AI recommendation */}
                            <td className="px-4 py-3 text-center">
                              {cfg.liveAvgMinutes !== null ? (
                                <div>
                                  <span className={`font-black text-base ${cfg.shouldUpdate ? 'text-sky-700' : 'text-thiso-600'}`}>
                                    {cfg.liveAvgMinutes}
                                  </span>
                                  <span className="text-xs text-thiso-400 ml-1">phút</span>
                                </div>
                              ) : (
                                <span className="text-thiso-300 text-xs">Chưa có dữ liệu</span>
                              )}
                            </td>
                            {/* Sample count */}
                            <td className="px-4 py-3 text-center">
                              <span className="font-mono text-thiso-600">{cfg.liveSampleCount}</span>
                            </td>
                            {/* Confidence */}
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${conf.color}`}>
                                {conf.text}
                              </span>
                            </td>
                            {/* Difference */}
                            <td className="px-4 py-3 text-center">
                              {cfg.diffMinutes !== null ? (
                                <span className={`text-sm font-bold ${
                                  cfg.diffMinutes > 2 ? 'text-red-600' :
                                  cfg.diffMinutes < -2 ? 'text-green-600' : 'text-thiso-400'
                                }`}>
                                  {cfg.diffMinutes > 0 ? '+' : ''}{cfg.diffMinutes} phút
                                </span>
                              ) : '—'}
                            </td>
                            {/* Action */}
                            <td className="px-4 py-3">
                              {canAccept ? (
                                <button
                                  onClick={() => acceptOne(cfg.id)}
                                  disabled={isAccepting}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                  <span>{isAccepting ? '⏳' : '✅'}</span>
                                  {isAccepting ? 'Đang lưu...' : `Chấp nhận ${cfg.liveAvgMinutes}'`}
                                </button>
                              ) : cfg.recommendedMinutes !== null && !cfg.shouldUpdate ? (
                                <span className="text-xs text-green-600 font-medium">✓ Đã tối ưu</span>
                              ) : (
                                <span className="text-xs text-thiso-300">Chạy phân tích trước</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 text-xs text-thiso-400 text-center">
        Dữ liệu phân tích dựa trên toàn bộ lịch sử nhận hàng. Phân tích lại định kỳ để khuyến nghị chính xác hơn.
      </div>
    </div>
  );
}
