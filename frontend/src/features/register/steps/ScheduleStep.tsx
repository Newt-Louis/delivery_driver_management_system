import type { UnitConfig, SlotInfo } from '../../../lib/types';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import OtherTimeModal from '../components/OtherTimeModal';
import { nextNDates } from '../utils/date';
import type { FormState, RegisterFieldErrors, SetFormField } from '../types';

type ScheduleStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  unitConfig: UnitConfig | null;
  slots: SlotInfo[];
  slotsMsg: string;
  slotsLoading: boolean;
  slotMinutes: number | undefined;
  maxPerSlot: number | undefined;
  sundayFreshFoodBlocked: boolean;
  showOtherTimeModal: boolean;
  setShowOtherTimeModal: (value: boolean) => void;
  set: SetFormField;
};

export default function ScheduleStep({
  form,
  fieldErrors,
  unitConfig,
  slots,
  slotsMsg,
  slotsLoading,
  slotMinutes,
  maxPerSlot,
  sundayFreshFoodBlocked,
  showOtherTimeModal,
  setShowOtherTimeModal,
  set,
}: ScheduleStepProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="label">Ngày giao hàng</p>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
          {nextNDates(7).map(({ value, label, sub }) => {
            const active = form.deliveryDate === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => set('deliveryDate', value)}
                className={`flex-shrink-0 snap-start flex flex-col items-center px-4 py-2.5 rounded-xl border-2 min-w-[68px] transition-all
                  ${active
                    ? 'border-thiso-800 bg-thiso-800 text-white'
                    : 'border-thiso-200 bg-white text-thiso-600 hover:border-thiso-400'}`}
              >
                <span className="text-xs font-bold">{label}</span>
                <span className={`text-[11px] mt-0.5 ${active ? 'text-thiso-300' : 'text-thiso-400'}`}>{sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {unitConfig && form.vehicleType && (
        <div className="flex items-center gap-2 text-xs text-thiso-500 bg-thiso-50 rounded-xl px-3 py-2.5 border border-thiso-100">
          <span>ℹ</span>
          <span>
            Mỗi slot <strong>{slotMinutes} phút</strong> — tối đa <strong>{maxPerSlot} xe</strong>/slot
            {form.goodsType === 'FRESH_FOOD' ? ' · Hàng tươi được ưu tiên gọi trước' : ''}
          </span>
        </div>
      )}

      <div>
        <p className="label">Chọn khung giờ <span className="text-red-400">*</span></p>

        {slotsLoading && (
          <div className="text-center py-8">
            <div className="text-3xl animate-pulse mb-2">⏳</div>
            <p className="text-sm text-thiso-400">Đang tải giờ khả dụng...</p>
          </div>
        )}

        {slotsMsg && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
            <span className="flex-shrink-0">⚠</span>
            <span>{slotsMsg}</span>
          </div>
        )}

        {sundayFreshFoodBlocked && !slotsMsg && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
            <span className="flex-shrink-0">⚠</span>
            <span>Chủ nhật chỉ nhận hàng tươi sống</span>
          </div>
        )}

        {!slotsLoading && slots.length > 0 && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
              {slots.map((s) => {
                const selected = form.timeSlot === s.time;
                const available = !s.isPast && s.available;
                const remaining = s.maxPerSlot - s.booked;

                let cls = '';
                if (s.isPast) cls = 'border-thiso-100 bg-thiso-50 text-thiso-300 cursor-not-allowed opacity-50';
                else if (!s.available) cls = 'border-red-200 bg-red-50 text-red-300 cursor-not-allowed';
                else if (selected) cls = 'border-thiso-800 bg-thiso-800 text-white shadow-card-md';
                else if (remaining === 1) cls = 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer';
                else cls = 'border-thiso-200 bg-white text-thiso-700 hover:border-thiso-400 hover:bg-thiso-50 cursor-pointer';

                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={s.isPast || !s.available}
                    onClick={() => set('timeSlot', s.time)}
                    className={`h-16 flex flex-col items-center justify-center rounded-xl border-2 transition-all ${cls}`}
                  >
                    <span className="font-mono font-bold text-sm leading-tight">{s.time}</span>
                    {!s.isPast && (
                      <span className={`text-[10px] mt-0.5 ${selected ? 'text-thiso-300' : available ? (remaining === 1 ? 'text-amber-500' : 'text-thiso-400') : 'text-red-300'}`}>
                        {!s.available ? 'Đầy' : remaining === 1 ? 'Còn 1 chỗ' : `Còn ${remaining}`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-thiso-400">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-thiso-200 bg-white inline-block" /> Trống
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-amber-300 bg-amber-50 inline-block" /> Gần đầy
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded border border-red-200 bg-red-50 inline-block" /> Đầy
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-thiso-800 inline-block" /> Đã chọn
              </span>
            </div>
          </>
        )}

        {!slotsLoading && slots.length === 0 && !slotsMsg && (
          <div className="text-center py-8 text-thiso-400">
            <div className="text-3xl mb-2">📅</div>
            <p className="text-sm">Không có khung giờ khả dụng cho ngày này</p>
          </div>
        )}

        {!sundayFreshFoodBlocked && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowOtherTimeModal(true)}
              className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl border-2 font-semibold text-sm transition-all
                ${form.timeSlot === 'OTHER'
                  ? 'border-amber-500 bg-amber-500 text-white'
                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'}`}
            >
              <span>⏰</span>
              <span>
                {form.timeSlot === 'OTHER'
                  ? '✓ Không có giờ cụ thể (đã chọn)'
                  : 'Khác — Đăng ký không có giờ cụ thể'}
              </span>
            </button>
            {form.timeSlot !== 'OTHER' && (
              <p className="text-[11px] text-thiso-400 mt-1 text-center">Dùng khi tất cả slot đầy hoặc không tìm được giờ phù hợp</p>
            )}
          </div>
        )}

        {fieldErrors.timeSlot && <FieldError text={fieldErrors.timeSlot} />}
      </div>

      {showOtherTimeModal && (
        <OtherTimeModal
          slots={slots}
          deliveryDate={form.deliveryDate}
          onConfirm={() => { set('timeSlot', 'OTHER'); setShowOtherTimeModal(false); }}
          onClose={() => setShowOtherTimeModal(false)}
        />
      )}

      <div className="border-t border-thiso-100 pt-1">
        <p className="text-[11px] text-thiso-400 font-semibold uppercase tracking-wider mb-4">Thông tin đơn hàng</p>
      </div>

      <div>
        <label className="label">Tên công ty / Nhà cung cấp <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.vendorName}
          onChange={e => set('vendorName', e.target.value)}
          placeholder="Công ty TNHH ABC"
          autoComplete="organization"
          className={`input py-3 ${fieldErrors.vendorName ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          style={{ fontSize: '16px' }}
        />
        <FieldHint text="Tên công ty hoặc đơn vị bạn đại diện giao hàng" />
        {fieldErrors.vendorName && <FieldError text={fieldErrors.vendorName} />}
      </div>

      <div>
        <label className="label">Số PO / Mã số thi công <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.poNumber}
          onChange={e => set('poNumber', e.target.value)}
          placeholder="VD: PO-2024-001 hoặc TC-2024-088"
          autoComplete="off"
          className={`input py-3 ${fieldErrors.poNumber ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          style={{ fontSize: '16px' }}
        />
        <FieldHint text="Bắt buộc — sẽ được đối chiếu với hệ thống của đơn vị nhận hàng" />
        {fieldErrors.poNumber && <FieldError text={fieldErrors.poNumber} />}
      </div>
    </div>
  );
}
