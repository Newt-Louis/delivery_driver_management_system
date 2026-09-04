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
  manualReferenceLoading: boolean;
  manualReferenceError: string;
  sundayFreshFoodBlocked: boolean;
  sundayFreshFoodOnly: boolean;
  set: SetFormField;
  onRetryManualReferenceCode: () => void;
};

export default function ScheduleStep({
  form,
  fieldErrors,
  highlightedField,
  dailyStats,
  dailyStatsMsg,
  dailyStatsLoading,
  manualReferenceLoading,
  manualReferenceError,
  sundayFreshFoodBlocked,
  sundayFreshFoodOnly,
  set,
  onRetryManualReferenceCode,
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
          Mã đối chiếu đăng ký <span className="text-thiso-300 font-normal normal-case">(tự động tạo)</span>
        </label>
        <input
          type="text"
          value={form.poNumber}
          readOnly
          placeholder="Đang tạo mã..."
          autoComplete="off"
          className="input py-3 bg-thiso-50 font-mono font-bold tracking-[0.2em]"
          style={{ fontSize: '16px' }}
        />
        {manualReferenceLoading && <FieldHint text="Đang tạo mã đối chiếu cho lượt đăng ký này..." />}
        {manualReferenceError ? (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
            <p className="text-xs font-medium text-red-700">{manualReferenceError}</p>
            <button type="button" onClick={onRetryManualReferenceCode} className="shrink-0 text-xs font-bold text-red-700 underline">Thử lại</button>
          </div>
        ) : !manualReferenceLoading && (
          <FieldHint text="Mã này được lưu cùng lượt đăng ký để đối chiếu hoặc hủy chuyến khi cần." />
        )}
        {fieldErrors.poNumber && <FieldError text={fieldErrors.poNumber} />}
      </FieldFrame>
    </div>
  );
}
