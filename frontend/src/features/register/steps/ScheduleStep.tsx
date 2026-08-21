import type { DailyRegistrationStat } from '../api';
import DeliveryDateCalendar from '../components/DeliveryDateCalendar';
import FieldFrame from '../components/FieldFrame';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import { isSundayDate } from '../utils/date';
import type { FormState, RegisterFieldErrors, SetFormField } from '../types';

type ScheduleStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  highlightedField: keyof FormState | null;
  dailyStats: DailyRegistrationStat[];
  dailyStatsMsg: string;
  dailyStatsLoading: boolean;
  sundayFreshFoodBlocked: boolean;
  sundayFreshFoodOnly: boolean;
  set: SetFormField;
};

export default function ScheduleStep({
  form,
  fieldErrors,
  highlightedField,
  dailyStats,
  dailyStatsMsg,
  dailyStatsLoading,
  sundayFreshFoodBlocked,
  sundayFreshFoodOnly,
  set,
}: ScheduleStepProps) {
  return (
    <div className="space-y-5">
      <FieldFrame field="deliveryDate" highlightedField={highlightedField} variant="choice">
        <p className="label">Ngày giao hàng <span className="text-red-400">*</span></p>

        {dailyStatsMsg && (
          <div className="mb-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
            <span className="flex-shrink-0">⚠</span>
            <span>{dailyStatsMsg}</span>
          </div>
        )}

        {sundayFreshFoodBlocked && (
          <div className="mb-3 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 flex items-start gap-2">
            <span className="flex-shrink-0">⚠</span>
            <span>Chủ nhật chỉ nhận hàng tươi sống</span>
          </div>
        )}

        <DeliveryDateCalendar
          value={form.deliveryDate}
          stats={dailyStats}
          loading={dailyStatsLoading}
          disabledReasonForDate={(date) => (
            sundayFreshFoodOnly && isSundayDate(date) && form.goodsType !== 'FRESH_FOOD' ? 'Chủ nhật chỉ nhận hàng tươi sống' : undefined
          )}
          onChange={(date) => set('deliveryDate', date)}
        />

        {fieldErrors.deliveryDate && <FieldError text={fieldErrors.deliveryDate} />}
      </FieldFrame>

      <div className="border-t border-thiso-100 pt-1">
        <p className="text-[11px] text-thiso-400 font-semibold uppercase tracking-wider mb-4">Thông tin đơn hàng</p>
      </div>

      <FieldFrame field="vendorName" highlightedField={highlightedField}>
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
      </FieldFrame>

      <FieldFrame field="poNumber" highlightedField={highlightedField}>
        <label className="label">
          Số PO / Mã số thi công <span className="text-thiso-300 font-normal normal-case">(Không bắt buộc)</span>
        </label>
        <input
          type="text"
          value={form.poNumber}
          onChange={e => set('poNumber', e.target.value)}
          placeholder="Nhập theo phiếu/bản giấy nếu có"
          autoComplete="off"
          className="input py-3"
          style={{ fontSize: '16px' }}
        />
      </FieldFrame>
    </div>
  );
}
