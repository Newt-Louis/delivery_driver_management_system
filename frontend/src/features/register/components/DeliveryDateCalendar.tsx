import dayjs from 'dayjs';
import { Calendar, Spin, theme } from 'antd';
import type { CSSProperties } from 'react';
import type { DailyRegistrationStat } from '../api';
import { todayDate } from '../utils/date';

type DeliveryDateCalendarProps = {
  value: string;
  stats: DailyRegistrationStat[];
  loading: boolean;
  disabledReasonForDate?: (date: string) => string | undefined;
  onChange: (date: string) => void;
};

export default function DeliveryDateCalendar({ value, stats, loading, disabledReasonForDate, onChange }: DeliveryDateCalendarProps) {
  const { token } = theme.useToken();
  const today = dayjs(todayDate());
  const statsByDate = new Map(stats.map((item) => [item.date, item]));
  const selectedDateStyle = {
    '--register-calendar-selected-bg': token.colorPrimaryBg,
    '--register-calendar-selected-border': token.colorPrimaryBorder,
    '--register-calendar-selected-text': token.colorPrimary,
  } as CSSProperties;

  return (
    <div className="relative">
      <Calendar
        className="register-date-calendar"
        style={selectedDateStyle}
        fullscreen={false}
        mode="month"
        value={dayjs(value)}
        disabledDate={(date) => date.isBefore(today, 'day') || Boolean(disabledReasonForDate?.(date.format('YYYY-MM-DD'))) || statsByDate.get(date.format('YYYY-MM-DD'))?.available === false}
        onSelect={(date) => {
          // Calendar uses its selected value as the visible month. When a
          // header move lands on an elapsed day in the current month, keep
          // the panel reachable by anchoring it at today instead of rejecting
          // the entire move.
          const selectedDate = date.isBefore(today, 'day') && date.isSame(today, 'month') ? today : date;
          if (!selectedDate.isBefore(today, 'day')) onChange(selectedDate.format('YYYY-MM-DD'));
        }}
        fullCellRender={(date, info) => {
          if (info.type !== 'date') return info.originNode;
          const isPast = date.isBefore(today, 'day');
          const isToday = date.isSame(today, 'day');
          return (
            <div className={`ant-picker-cell-inner ant-picker-calendar-date ${isToday ? 'ant-picker-calendar-date-today' : ''}`}>
              {!isPast && <div className="ant-picker-calendar-date-value">{date.format('DD')}</div>}
            </div>
          );
        }}
      />
      {loading && <div className="absolute inset-0 grid place-items-center bg-white/70"><Spin description="Đang tải công suất..." /></div>}
    </div>
  );
}
