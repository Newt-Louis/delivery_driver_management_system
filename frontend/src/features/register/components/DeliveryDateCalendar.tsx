import type { DailyRegistrationStat } from '../api';
import { todayDate } from '../utils/date';

type DeliveryDateCalendarProps = {
  value: string;
  stats: DailyRegistrationStat[];
  loading: boolean;
  disabledReasonForDate?: (date: string) => string | undefined;
  onChange: (date: string) => void;
};

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dayClass(stat: DailyRegistrationStat | undefined, selected: boolean, disabled: boolean) {
  if (disabled) return 'border-thiso-100 bg-thiso-50 text-thiso-300 cursor-not-allowed opacity-60';
  if (stat?.level === 'high') {
    return selected
      ? 'border-red-400 bg-red-200 text-red-900 translate-y-px shadow-[inset_0_2px_5px_rgba(15,15,15,0.18)]'
      : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100';
  }
  if (stat?.level === 'medium') {
    return selected
      ? 'border-amber-400 bg-amber-200 text-amber-900 translate-y-px shadow-[inset_0_2px_5px_rgba(15,15,15,0.18)]'
      : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100';
  }
  return selected
    ? 'border-green-400 bg-green-200 text-green-900 translate-y-px shadow-[inset_0_2px_5px_rgba(15,15,15,0.18)]'
    : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100';
}

export default function DeliveryDateCalendar({
  value,
  stats,
  loading,
  disabledReasonForDate,
  onChange,
}: DeliveryDateCalendarProps) {
  const today = todayDate();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const leadingBlanks = firstDay === 0 ? 6 : firstDay - 1;
  const statsByDate = new Map(stats.map((item) => [item.date, item]));

  return (
    <div className="rounded-2xl border border-thiso-100 bg-white p-3 shadow-card">
      <div className="flex items-center justify-between px-1 pb-3">
        <p className="text-sm font-black text-thiso-800 capitalize">{monthLabel}</p>
        {loading && <span className="text-xs font-semibold text-thiso-400 animate-pulse">Đang tải...</span>}
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-thiso-400 mb-1.5">
        {WEEKDAYS.map((day) => <span key={day}>{day}</span>)}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <div key={`blank-${index}`} className="aspect-square" />
        ))}

        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1;
          const date = dateKey(new Date(year, month, day));
          const stat = statsByDate.get(date);
          const externalReason = disabledReasonForDate?.(date);
          const isPast = date < today;
          const disabled = isPast || Boolean(externalReason) || stat?.available === false;
          const selected = value === date;
          const capacityText = stat?.capacity && stat.capacity > 0
            ? `${Math.round((stat.percent ?? 0) * 100)}%`
            : '';

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              title={externalReason ?? stat?.reason}
              onClick={() => onChange(date)}
              className={`aspect-square min-h-[64px] rounded-xl border-2 p-1.5 text-left transition-all duration-150 ease-out active:translate-y-px active:scale-[0.98] ${dayClass(stat, selected, disabled)}`}
            >
              <span className="block text-sm font-black leading-none">{day}</span>
              <span className="mt-1 block text-[9px] font-semibold leading-tight">
                Đã có {stat?.registered ?? 0} xe đã đăng ký
              </span>
              {capacityText && (
                <span className="mt-0.5 block text-[9px] font-bold leading-tight">
                  {capacityText}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] font-semibold text-thiso-500">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-green-200 bg-green-50" /> Dưới 50%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" /> 50-80%
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded border border-red-200 bg-red-50" /> Trên 80%
        </span>
      </div>
    </div>
  );
}
