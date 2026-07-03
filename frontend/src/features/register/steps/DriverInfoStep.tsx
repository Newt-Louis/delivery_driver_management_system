import { FieldError, FieldHint } from '../components/FieldFeedback';
import type { FormState, RegisterFieldErrors, SetFormField } from '../types';

type DriverInfoStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  rememberInfo: boolean;
  setRememberInfo: (updater: (value: boolean) => boolean) => void;
  awStatus: 'idle' | 'loading' | 'match' | 'nomatch';
  awVendorName: string;
  set: SetFormField;
};

export default function DriverInfoStep({
  form,
  fieldErrors,
  rememberInfo,
  setRememberInfo,
  awStatus,
  awVendorName,
  set,
}: DriverInfoStepProps) {
  return (
    <div className="space-y-5">
      {(form.driverName || form.vehiclePlate) && (
        <div className="flex items-center gap-2.5 bg-sky-50 border border-sky-200 rounded-xl p-3">
          <span className="text-sky-500">💾</span>
          <p className="text-xs text-sky-700">Đã điền sẵn thông tin từ lần trước. Kiểm tra lại và chỉnh nếu cần.</p>
        </div>
      )}

      <div>
        <label className="label">Biển số xe <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.vehiclePlate}
          onChange={e => set('vehiclePlate', e.target.value.toUpperCase().replace(/[^A-Z0-9\-\.]/g, ''))}
          placeholder="51C-123.45"
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          className={`input text-base py-3 font-mono tracking-widest ${fieldErrors.vehiclePlate ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          style={{ fontSize: '16px' }}
        />
        <FieldHint text="Ví dụ: 51C-123.45 — nhập chữ in hoa, không cần dấu cách" />
        {fieldErrors.vehiclePlate && <FieldError text={fieldErrors.vehiclePlate} />}
      </div>

      <div>
        <label className="label">Tên tài xế <span className="text-red-400">*</span></label>
        <input
          type="text"
          value={form.driverName}
          onChange={e => set('driverName', e.target.value)}
          placeholder="Nguyễn Văn A"
          autoComplete="name"
          className={`input py-3 ${fieldErrors.driverName ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          style={{ fontSize: '16px' }}
        />
        {fieldErrors.driverName && <FieldError text={fieldErrors.driverName} />}
      </div>

      <div>
        <label className="label">Số điện thoại <span className="text-red-400">*</span></label>
        <input
          type="tel"
          inputMode="numeric"
          value={form.driverPhone}
          onChange={e => set('driverPhone', e.target.value.replace(/[^\d+\-\s]/g, ''))}
          placeholder="0901 234 567"
          autoComplete="tel"
          className={`input py-3 ${fieldErrors.driverPhone ? 'border-red-400 ring-1 ring-red-400' : ''}`}
          style={{ fontSize: '16px' }}
        />
        <FieldHint text="Số này dùng để liên lạc khi cần. Không bắt buộc mã vùng." />
        {fieldErrors.driverPhone && <FieldError text={fieldErrors.driverPhone} />}
      </div>

      <div>
        <label className="label">
          Mã nhà cung cấp (NCC)
          <span className="text-thiso-300 font-normal normal-case tracking-normal ml-1">(không bắt buộc)</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={form.vendorCode}
            onChange={e => set('vendorCode', e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="VD: SUP001, NCCABC..."
            autoComplete="off"
            autoCorrect="off"
            className={`input py-3 pr-10 ${awStatus === 'match' ? 'border-green-400 ring-1 ring-green-300' : ''}`}
            style={{ fontSize: '16px' }}
          />
          {awStatus === 'loading' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-thiso-400 text-sm animate-pulse">⏳</span>
          )}
          {awStatus === 'match' && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 font-bold">✓</span>
          )}
        </div>
        {awStatus === 'match' && (
          <div className="mt-2 flex items-center gap-2.5 px-3 py-2.5 bg-green-50 border border-green-200 rounded-xl">
            <span className="text-lg flex-shrink-0">🏭</span>
            <div>
              <p className="text-xs font-bold text-green-800">Kho tự động — NCC được phép vào kho</p>
              {awVendorName && <p className="text-[11px] text-green-600 mt-0.5">{awVendorName}</p>}
            </div>
          </div>
        )}
        <FieldHint text="Nếu có mã NCC, hệ thống sẽ tự xếp vào khu kho tự động khi được phép" />
      </div>

      <label className="flex items-center gap-3 p-3.5 bg-thiso-50 rounded-xl cursor-pointer border border-thiso-100">
        <div
          onClick={() => setRememberInfo(v => !v)}
          className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 relative ${rememberInfo ? 'bg-sky-500' : 'bg-thiso-200'}`}
        >
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${rememberInfo ? 'left-5' : 'left-1'}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-thiso-700">Ghi nhớ thông tin của tôi</p>
          <p className="text-[11px] text-thiso-400">Điền sẵn biển số, tên, SĐT cho lần sau</p>
        </div>
      </label>
    </div>
  );
}
