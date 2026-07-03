import { UNIT_FALLBACKS, type UnitBranding } from '../../../context/BrandingContext';
import { GOODS_LABEL, VEHICLE_INFO } from '../constants';
import type { FormState, SetFormField, Unit, VehicleType } from '../types';

type ReviewSubmitStepProps = {
  form: FormState;
  brandUnits: Record<Unit, UnitBranding>;
  awStatus: 'idle' | 'loading' | 'match' | 'nomatch';
  awVendorName: string;
  submitError: string;
  set: SetFormField;
  onEditStep: (step: 1 | 2 | 3) => void;
};

export default function ReviewSubmitStep({
  form,
  brandUnits,
  awStatus,
  awVendorName,
  submitError,
  set,
  onEditStep,
}: ReviewSubmitStepProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-thiso-100 shadow-card overflow-hidden">
        <div className="bg-thiso-800 px-4 py-3">
          <p className="text-xs text-thiso-400 font-semibold uppercase tracking-wider">Tóm tắt đăng ký</p>
        </div>
        <div className="divide-y divide-thiso-100">
          {[
            { icon: '🏢', label: 'Đơn vị nhận', value: `${UNIT_FALLBACKS[form.receivingUnit as Unit]?.icon ?? ''} ${(brandUnits[form.receivingUnit as Unit] ?? UNIT_FALLBACKS[form.receivingUnit as Unit])?.displayName ?? form.receivingUnit}` },
            { icon: '📦', label: 'Loại hàng', value: GOODS_LABEL[form.goodsType] ?? form.goodsType },
            { icon: '🚗', label: 'Biển số xe', value: form.vehiclePlate, mono: true },
            { icon: VEHICLE_INFO[form.vehicleType as VehicleType]?.icon ?? '🚗', label: 'Loại xe', value: VEHICLE_INFO[form.vehicleType as VehicleType]?.label ?? form.vehicleType },
            { icon: '👤', label: 'Tài xế', value: form.driverName },
            { icon: '📞', label: 'Điện thoại', value: form.driverPhone, mono: true },
            { icon: '🏭', label: 'Nhà cung cấp', value: form.vendorName },
            ...(form.vendorCode ? [{ icon: '🔑', label: 'Mã NCC', value: form.vendorCode, mono: true as const }] : []),
            { icon: '📋', label: 'Số PO / Mã thi công', value: form.poNumber, mono: true as const },
            { icon: '📅', label: 'Ngày giao', value: form.deliveryDate.split('-').reverse().join('/') },
            { icon: '🕐', label: 'Giờ giao', value: form.timeSlot === 'OTHER' ? 'Không có giờ cụ thể' : form.timeSlot, mono: form.timeSlot !== 'OTHER' },
          ].map(({ icon, label, value, mono }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-2.5 flex-shrink-0 min-w-[130px]">
                <span className="text-sm">{icon}</span>
                <span className="text-xs text-thiso-500">{label}</span>
              </div>
              <span className={`text-sm font-semibold text-thiso-800 text-right ${mono ? 'font-mono' : ''}`}>
                {value as string}
              </span>
            </div>
          ))}
        </div>
        {awStatus === 'match' && (
          <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center gap-2.5">
            <span className="text-base">🏭</span>
            <p className="text-xs font-semibold text-green-700">
              Kho tự động — xe sẽ được điều phối vào khu kho tự động
              {awVendorName ? ` (${awVendorName})` : ''}
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onEditStep(1)} className="flex-1 py-2 text-xs text-thiso-500 bg-white border border-thiso-200 rounded-xl hover:bg-thiso-50 transition-colors">
          ✏ Sửa điểm giao
        </button>
        <button onClick={() => onEditStep(2)} className="flex-1 py-2 text-xs text-thiso-500 bg-white border border-thiso-200 rounded-xl hover:bg-thiso-50 transition-colors">
          ✏ Sửa giờ & đơn hàng
        </button>
        <button onClick={() => onEditStep(3)} className="flex-1 py-2 text-xs text-thiso-500 bg-white border border-thiso-200 rounded-xl hover:bg-thiso-50 transition-colors">
          ✏ Sửa thông tin xe
        </button>
      </div>

      <div>
        <label className="label">Ghi chú <span className="text-thiso-300 font-normal normal-case">(Không bắt buộc)</span></label>
        <textarea
          rows={2}
          value={form.note}
          onChange={e => set('note', e.target.value)}
          placeholder="Yêu cầu đặc biệt, hàng dễ vỡ, cần xe nâng..."
          className="input py-3"
          style={{ fontSize: '16px' }}
        />
      </div>

      {submitError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
          <span>⚠</span><span>{submitError}</span>
        </div>
      )}

      <p className="text-[11px] text-thiso-300 text-center leading-relaxed">
        Thông tin đăng ký chỉ dùng cho mục đích quản lý giao hàng tại mall.
        Bằng cách nhấn "Hoàn tất đăng ký" bạn đồng ý với điều này.
      </p>
    </div>
  );
}
