import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import api from '../lib/api';
import { useBranding, UNIT_FALLBACKS } from '../context/BrandingContext';
import type { UnitConfig, SlotInfo, UnitGoodsType } from '../lib/types';

type Unit = 'EMART' | 'THISKYHALL' | 'TENANT';
type GoodsType = 'FRESH_FOOD' | 'GENERAL_GOODS' | 'THI_CONG';
type VehicleType = 'TRUCK' | 'MOTORBIKE' | 'OTHER';

interface FormState {
  receivingUnit: Unit | '';
  goodsType: GoodsType | '';
  unitGoodsTypeId: string;
  vehicleType: VehicleType | '';
  vendorName: string;
  poNumber: string;
  driverName: string;
  driverPhone: string;
  vehiclePlate: string;
  deliveryDate: string;
  timeSlot: string;
  note: string;
}

interface SuccessInfo {
  code: string;
  vehiclePlate: string;
  vendorName: string;
  driverName: string;
  receivingUnit: Unit;
  goodsType: GoodsType | '';
  goodsTypeName: string;
  vehicleType: VehicleType | '';
  requestedTime: string;
}

// Static styling config — colors/classes stay fixed; display names/descriptions come from branding context
const UNIT_STYLE: Record<Unit, {
  border: string; bg: string; activeBorder: string; activeBg: string; activeText: string;
}> = {
  EMART:      { border: 'border-thiso-200', bg: 'bg-white', activeBorder: 'border-emart-400', activeBg: 'bg-emart-50',   activeText: 'text-emart-700'  },
  THISKYHALL: { border: 'border-thiso-200', bg: 'bg-white', activeBorder: 'border-sky-500',   activeBg: 'bg-sky-50',    activeText: 'text-sky-700'    },
  TENANT:     { border: 'border-thiso-200', bg: 'bg-white', activeBorder: 'border-thiso-500', activeBg: 'bg-thiso-100', activeText: 'text-thiso-700'  },
};

const VEHICLE_INFO: Record<VehicleType, {
  label: string; icon: string; activeBorder: string; activeBg: string; hint: string;
}> = {
  TRUCK:     { label: 'Xe Tải',  icon: '🚛', activeBorder: 'border-emart-400',  activeBg: 'bg-emart-50',  hint: 'Xe tải, xe container' },
  MOTORBIKE: { label: 'Xe Máy', icon: '🛵', activeBorder: 'border-sky-400',    activeBg: 'bg-sky-50',    hint: 'Xe máy, xe gắn máy' },
  OTHER:     { label: 'Khác',   icon: '🚐', activeBorder: 'border-thiso-400',  activeBg: 'bg-thiso-100', hint: 'Van, xe ô tô nhỏ...' },
};

const GOODS_LABEL: Record<string, string> = {
  FRESH_FOOD:    '🥬 Hàng tươi sống',
  GENERAL_GOODS: '📦 Hàng thường',
  AUTO_WAREHOUSE:'🏭 Kho tự động',
  THI_CONG:      '🔨 Thi công',
};

const STEP_TITLES = ['Điểm giao & Loại hàng', 'Thông tin tài xế', 'Chọn giờ giao', 'Xác nhận'];
const STEP_HINTS  = [
  'Chọn nơi bạn sẽ giao hàng đến',
  'Thông tin xe và người liên hệ',
  'Đặt giờ hẹn giao hàng',
  'Kiểm tra lại trước khi xác nhận',
];

const LS_KEY = 'qms_driver_info';

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nextNDates(n: number): { value: string; label: string; sub: string }[] {
  const result = [];
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = i === 0 ? 'Hôm nay' : dayNames[d.getDay()];
    const sub   = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push({ value, label, sub });
  }
  return result;
}

// ─── Process Guide ────────────────────────────────────────────────────────────

function ProcessGuide({ onDismiss }: { onDismiss: () => void }) {
  const steps = [
    { icon: '📝', label: 'Đăng ký', desc: 'Điền form → nhận mã QR' },
    { icon: '🔍', label: 'Check-in', desc: 'Đưa QR cho bảo vệ cổng' },
    { icon: '⏳', label: 'Chờ gọi', desc: 'Theo dõi màn hình TV' },
    { icon: '🚚', label: 'Vào dock', desc: 'Giao hàng & hoàn tất' },
  ];
  return (
    <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sky-600 text-base">ℹ</span>
          <span className="text-sm font-bold text-sky-800">Quy trình giao hàng</span>
        </div>
        <button
          onClick={onDismiss}
          className="w-7 h-7 flex items-center justify-center rounded-full text-sky-400 hover:bg-sky-200 transition-colors text-xl leading-none"
          aria-label="Đóng hướng dẫn"
        >×</button>
      </div>
      <div className="flex items-start gap-1">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center flex-1 min-w-0">
            <div className="flex-1 text-center min-w-0">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xs font-bold text-sky-800 leading-tight">{s.label}</div>
              <div className="text-[10px] text-sky-500 mt-0.5 leading-tight">{s.desc}</div>
            </div>
            {i < steps.length - 1 && (
              <div className="text-sky-300 text-sm px-0.5 flex-shrink-0 mt-[-18px]">›</div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-sky-600 mt-3 border-t border-sky-200 pt-2">
        Đăng ký trước để được ưu tiên gọi xe sớm hơn. Mã QR nhận được dùng để check-in tại cổng.
      </p>
    </div>
  );
}

// ─── Success Screen ───────────────────────────────────────────────────────────

function SuccessScreen({ info, onReset }: { info: SuccessInfo; onReset: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const { units } = useBranding();

  const trackUrl = `${window.location.origin}/track/${info.code}`;

  useEffect(() => {
    QRCode.toDataURL(trackUrl, {
      width: 320, margin: 2,
      color: { dark: '#1C1C1C', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setQrDataUrl).catch(console.error);
  }, [trackUrl]);

  function downloadQR() {
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-${info.code}-${info.vehiclePlate}.png`;
    a.click();
  }

  function printTicket() {
    const win = window.open('', '_blank', 'width=420,height=640');
    if (!win) return;
    const ub = units[info.receivingUnit] ?? UNIT_FALLBACKS[info.receivingUnit];
    const fb = UNIT_FALLBACKS[info.receivingUnit];
    const logoHtml = ub.logoUrl
      ? `<img src="${ub.logoUrl}" style="width:32px;height:32px;object-fit:contain;vertical-align:middle;margin-right:6px"/>`
      : fb.icon;
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<title>Phiếu ${info.code}</title>
<style>
  body{font-family:Arial,sans-serif;padding:16px;color:#1C1C1C;margin:0}
  .ticket{max-width:360px;margin:0 auto;border:2px solid #1C1C1C;border-radius:12px;padding:20px}
  h2{text-align:center;font-size:17px;margin:0 0 2px}
  .sub{text-align:center;font-size:11px;color:#818181;margin-bottom:12px}
  .code{text-align:center;font-size:30px;font-weight:900;letter-spacing:5px;font-family:monospace;
        background:#f0f4ff;padding:10px;border-radius:8px;margin:10px 0}
  .qr{text-align:center;margin:14px 0}.qr img{width:200px;height:200px}
  .row{display:flex;justify-content:space-between;font-size:12px;padding:5px 0;border-bottom:1px solid #ebebeb}
  .lbl{color:#818181}.val{font-weight:700;text-align:right;max-width:60%}
  .footer{text-align:center;font-size:10px;color:#ababab;margin-top:14px;line-height:1.6}
</style></head><body><div class="ticket">
<h2>Phiếu Đăng Ký Giao Hàng</h2>
<div class="sub">${logoHtml} ${ub.displayName}</div>
<div class="code">${info.code}</div>
<div class="qr"><img src="${qrDataUrl}"/></div>
<div class="row"><span class="lbl">Biển số</span><span class="val">${info.vehiclePlate}</span></div>
<div class="row"><span class="lbl">Tài xế</span><span class="val">${info.driverName}</span></div>
<div class="row"><span class="lbl">Nhà cung cấp</span><span class="val">${info.vendorName}</span></div>
<div class="row"><span class="lbl">Loại hàng</span><span class="val">${info.goodsTypeName || GOODS_LABEL[info.goodsType] || info.goodsType}</span></div>
<div class="row"><span class="lbl">Giờ dự kiến</span><span class="val">${info.requestedTime}</span></div>
<div class="footer">
  Đưa QR cho bảo vệ scan để check-in<br>
  Theo dõi: <span style="font-size:9px;color:#555">${trackUrl}</span>
</div>
</div></body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }

  const unitBrand = units[info.receivingUnit] ?? UNIT_FALLBACKS[info.receivingUnit];
  const unitFb    = UNIT_FALLBACKS[info.receivingUnit];

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-green-500 px-4 pt-10 pb-6 text-center">
        <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-3xl">✅</span>
        </div>
        <h2 className="text-xl font-black text-white">Đăng ký thành công!</h2>
        <p className="text-green-100 text-sm mt-1">{unitFb.icon} {unitBrand.displayName}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-5 pb-6 max-w-sm mx-auto w-full space-y-4">

        {/* QR + code — hero card */}
        <div className="bg-white rounded-2xl border-2 border-thiso-100 p-5 text-center shadow-card">
          <p className="text-[11px] font-bold text-thiso-400 uppercase tracking-widest mb-3">
            Đưa QR này cho bảo vệ scan
          </p>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`QR ${info.code}`} className="w-56 h-56 mx-auto rounded-xl" />
          ) : (
            <div className="w-56 h-56 mx-auto rounded-xl bg-thiso-50 flex items-center justify-center">
              <span className="text-2xl animate-pulse">⏳</span>
            </div>
          )}
          <div className="mt-3 font-mono font-black text-2xl tracking-widest text-thiso-800">
            {info.code}
          </div>
          <div className="mt-1 flex items-center justify-center gap-3 text-xs text-thiso-400">
            <span className="font-mono font-semibold">{info.vehiclePlate}</span>
            <span>·</span>
            <span>{info.goodsTypeName || GOODS_LABEL[info.goodsType] || info.goodsType}</span>
            <span>·</span>
            <span>{info.requestedTime.split(' ')[0]}</span>
          </div>
        </div>

        {/* Steps — compact */}
        <div className="flex gap-0 bg-thiso-50 rounded-2xl overflow-hidden border border-thiso-100">
          {[
            { icon: '🔐', label: 'Check-in cổng', desc: 'Đưa QR cho bảo vệ' },
            { icon: '⏳', label: 'Chờ gọi', desc: 'Theo dõi màn hình' },
            { icon: '🚚', label: 'Vào dock', desc: 'Khi được gọi số' },
          ].map((s, i) => (
            <div key={i} className={`flex-1 text-center px-2 py-3 ${i < 2 ? 'border-r border-thiso-200' : ''}`}>
              <div className="text-xl mb-1">{s.icon}</div>
              <p className="text-[11px] font-bold text-thiso-700 leading-tight">{s.label}</p>
              <p className="text-[10px] text-thiso-400 mt-0.5 leading-tight">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <a
          href={trackUrl}
          className="h-13 flex items-center justify-center gap-2 w-full bg-thiso-800 text-white rounded-2xl font-bold text-base hover:bg-thiso-900 transition-colors py-3.5"
        >
          📱 Theo dõi hành trình →
        </a>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={downloadQR}
            disabled={!qrDataUrl}
            className="h-11 flex items-center justify-center gap-2 bg-thiso-100 text-thiso-700 rounded-xl font-bold text-sm hover:bg-thiso-200 disabled:opacity-40 transition-colors"
          >
            ⬇ Tải QR
          </button>
          <button
            onClick={printTicket}
            disabled={!qrDataUrl}
            className="h-11 flex items-center justify-center gap-2 bg-thiso-100 text-thiso-700 rounded-xl font-bold text-sm hover:bg-thiso-200 disabled:opacity-40 transition-colors"
          >
            🖨 In phiếu
          </button>
        </div>

        <button
          onClick={onReset}
          className="h-11 w-full border border-thiso-200 text-thiso-500 rounded-xl font-semibold text-sm hover:bg-thiso-50 transition-colors"
        >
          Đăng ký chuyến khác
        </button>
      </div>
    </div>
  );
}

// ─── Field helpers ─────────────────────────────────────────────────────────────

function FieldHint({ text }: { text: string }) {
  return <p className="text-[11px] text-thiso-400 mt-1 leading-relaxed">{text}</p>;
}

function FieldError({ text }: { text: string }) {
  return <p className="text-[11px] text-red-500 mt-1 font-medium">⚠ {text}</p>;
}

// ─── Main Register ─────────────────────────────────────────────────────────────

export default function Register() {
  const [step, setStep]         = useState(1);
  const [guideOpen, setGuideOpen] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess]         = useState<SuccessInfo | null>(null);

  const [form, setForm] = useState<FormState>(() => {
    const saved = localStorage.getItem(LS_KEY);
    const prev = saved ? (JSON.parse(saved) as Partial<FormState>) : {};
    return {
      receivingUnit: '', goodsType: '', unitGoodsTypeId: '', vehicleType: '',
      vendorName:   prev.vendorName   ?? '',
      poNumber:     '',
      driverName:   prev.driverName   ?? '',
      driverPhone:  prev.driverPhone  ?? '',
      vehiclePlate: prev.vehiclePlate ?? '',
      deliveryDate: todayDate(),
      timeSlot: '', note: '',
    };
  });

  const [rememberInfo, setRememberInfo]         = useState(true);
  const [unitConfig, setUnitConfig]             = useState<UnitConfig | null>(null);
  const [customGoodsTypes, setCustomGoodsTypes] = useState<UnitGoodsType[]>([]);
  const [slots, setSlots]                       = useState<SlotInfo[]>([]);
  const [slotsMsg, setSlotsMsg]                 = useState('');
  const [slotsLoading, setSlotsLoading]         = useState(false);

  const contentRef = useRef<HTMLDivElement>(null);

  const set = useCallback((key: keyof FormState, val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    setFieldErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }, []);

  // Fetch unit config and custom goods types when unit changes
  useEffect(() => {
    if (!form.receivingUnit) { setUnitConfig(null); setCustomGoodsTypes([]); return; }
    api.get(`/api/units/${form.receivingUnit}/config`).then(r => setUnitConfig(r.data)).catch(() => {});
    api.get(`/api/units/${form.receivingUnit}/goods-types`).then(r => setCustomGoodsTypes(r.data)).catch(() => setCustomGoodsTypes([]));
  }, [form.receivingUnit]);

  // Fetch time slots when reaching step 3
  useEffect(() => {
    if (step !== 3 || !form.receivingUnit || !form.goodsType || !form.vehicleType || !form.deliveryDate) return;
    setSlotsLoading(true);
    setSlotsMsg('');
    setSlots([]);
    setForm(f => ({ ...f, timeSlot: '' }));
    const slotParams: Record<string, string> = {
      date: form.deliveryDate,
      goodsType: form.goodsType,
      vehicleType: form.vehicleType,
    };
    if (form.unitGoodsTypeId) slotParams.unitGoodsTypeId = form.unitGoodsTypeId;
    api.get(`/api/units/${form.receivingUnit}/slots`, { params: slotParams })
      .then(r => { setSlots(r.data.slots ?? []); if (r.data.reason) setSlotsMsg(r.data.reason); })
      .catch(() => setSlotsMsg('Không thể tải danh sách giờ. Vui lòng thử lại.'))
      .finally(() => setSlotsLoading(false));
  }, [step, form.receivingUnit, form.goodsType, form.vehicleType, form.deliveryDate]);

  // Scroll to top on step change
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  function validateStep(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (step === 1) {
      if (!form.receivingUnit) errs.receivingUnit = 'Vui lòng chọn đơn vị nhận hàng';
      else if (!form.goodsType) errs.goodsType = 'Vui lòng chọn loại hàng';
      else if (!form.vehicleType) errs.vehicleType = 'Vui lòng chọn loại phương tiện';
    }
    if (step === 2) {
      if (!form.vehiclePlate.trim()) errs.vehiclePlate = 'Vui lòng nhập biển số xe';
      if (!form.driverName.trim())   errs.driverName   = 'Vui lòng nhập tên tài xế';
      if (form.driverPhone.replace(/\D/g, '').length < 9) errs.driverPhone = 'Số điện thoại không hợp lệ (cần ít nhất 9 số)';
      if (!form.vendorName.trim())   errs.vendorName   = 'Vui lòng nhập tên công ty / nhà cung cấp';
      if (!form.poNumber.trim())     errs.poNumber     = 'Vui lòng nhập Số PO hoặc Mã số thi công';
    }
    if (step === 3) {
      if (!form.timeSlot) errs.timeSlot = 'Vui lòng chọn khung giờ giao hàng';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (!validateStep()) return;
    if (rememberInfo && step === 2) {
      localStorage.setItem(LS_KEY, JSON.stringify({
        driverName: form.driverName,
        driverPhone: form.driverPhone,
        vehiclePlate: form.vehiclePlate,
        vendorName: form.vendorName,
      }));
    }
    setStep(s => Math.min(s + 1, 4));
  }

  function back() {
    setFieldErrors({});
    setSubmitError('');
    setStep(s => Math.max(s - 1, 1));
  }

  async function submit() {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const requestedTime = `${form.deliveryDate}T${form.timeSlot}:00`;
      const plate = form.vehiclePlate.toUpperCase().replace(/\s+/g, '');
      const selectedCustomType = customGoodsTypes.find(ct => ct.id === form.unitGoodsTypeId);
      const res = await api.post('/api/deliveries/register', {
        vendorName:      form.vendorName,
        driverName:      form.driverName,
        driverPhone:     form.driverPhone,
        vehiclePlate:    plate,
        vehicleType:     form.vehicleType,
        receivingUnit:   form.receivingUnit,
        goodsType:       form.goodsType,
        unitGoodsTypeId: form.unitGoodsTypeId || undefined,
        poNumber:        form.poNumber,
        requestedTime,
        note:            form.note || undefined,
      });
      setSuccess({
        code:          res.data.registrationCode,
        vehiclePlate:  plate,
        vendorName:    form.vendorName,
        driverName:    form.driverName,
        receivingUnit: form.receivingUnit as Unit,
        goodsType:     form.goodsType,
        goodsTypeName: selectedCustomType ? `${selectedCustomType.emoji} ${selectedCustomType.name}` : '',
        vehicleType:   form.vehicleType,
        requestedTime: `${form.timeSlot} ngày ${form.deliveryDate.split('-').reverse().join('/')}`,
      });
    } catch (err: unknown) {
      const d = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setSubmitError(d?.message ?? d?.error ?? 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSuccess(null); setStep(1); setFieldErrors({}); setSubmitError('');
    setForm(f => ({
      ...f, receivingUnit: '', goodsType: '', unitGoodsTypeId: '', vehicleType: '',
      deliveryDate: todayDate(), timeSlot: '', note: '', poNumber: '',
    }));
  }

  if (success) return <SuccessScreen info={success} onReset={resetForm} />;

  const { units: brandUnits } = useBranding();
  const unitCfg = unitConfig;
  const slotMinutes = form.vehicleType === 'MOTORBIKE' ? unitCfg?.motorbikeSlotMinutes : unitCfg?.truckSlotMinutes;
  const maxPerSlot  = form.vehicleType === 'MOTORBIKE' ? unitCfg?.motorbikeMaxPerSlot  : unitCfg?.truckMaxPerSlot;

  return (
    <div className="flex flex-col min-h-screen bg-thiso-50">

      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-thiso-100 shadow-sm">
        <div className="max-w-xl mx-auto">
          {/* Tab menu — always visible for driver navigation */}
          <div className="flex border-b border-thiso-100">
            <div className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-black text-sky-600 border-b-2 border-sky-500">
              <span>📝</span> Đăng ký mới
            </div>
            <a
              href="/track"
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-thiso-400 hover:text-thiso-700 hover:bg-thiso-50 transition-colors"
            >
              <span>📱</span> Theo dõi đơn
            </a>
          </div>

          {/* Step info + progress */}
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-bold text-thiso-800 leading-tight">{STEP_TITLES[step - 1]}</p>
              <span className="text-xs text-thiso-400">
                Bước <span className="font-black text-thiso-700">{step}</span>/4
              </span>
            </div>
            <div className="h-1 bg-thiso-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full transition-all duration-500"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable content ────────────────────────────────────────────── */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 pt-5 pb-32 max-w-xl mx-auto w-full">

        {/* Step hint */}
        <p className="text-sm text-thiso-400 mb-4">{STEP_HINTS[step - 1]}</p>

        {/* ── STEP 1: Unit / Goods / Vehicle ── */}
        {step === 1 && (
          <div className="space-y-5">
            {/* Driver shortcut — visible if they already registered */}
            <a
              href="/track"
              className="flex items-center gap-3 p-3.5 bg-thiso-800 rounded-2xl text-white active:opacity-80 transition-opacity"
            >
              <span className="text-2xl flex-shrink-0">📱</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-tight">Đã đăng ký rồi?</p>
                <p className="text-thiso-300 text-xs mt-0.5">Theo dõi đơn hoặc tra cứu bằng biển số xe</p>
              </div>
              <span className="text-thiso-400 text-lg flex-shrink-0">›</span>
            </a>

            {guideOpen && <ProcessGuide onDismiss={() => setGuideOpen(false)} />}

            {/* Unit selection */}
            <div>
              <p className="label">Bạn giao hàng đến đâu? <span className="text-red-400">*</span></p>
              <div className="space-y-2.5">
                {(['EMART', 'THISKYHALL', 'TENANT'] as Unit[]).map((u) => {
                  const style  = UNIT_STYLE[u];
                  const brand  = brandUnits[u] ?? UNIT_FALLBACKS[u];
                  const fb     = UNIT_FALLBACKS[u];
                  const active = form.receivingUnit === u;
                  return (
                    <button
                      key={u}
                      type="button"
                      onClick={() => { set('receivingUnit', u); set('goodsType', ''); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left
                        ${active
                          ? `${style.activeBorder} ${style.activeBg} shadow-card-md`
                          : `${style.border} ${style.bg} hover:border-thiso-300`}`}
                    >
                      {brand.logoUrl ? (
                        <img src={brand.logoUrl} alt={brand.displayName} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 bg-white p-1 border border-thiso-100" />
                      ) : (
                        <span className="text-3xl flex-shrink-0">{fb.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-base ${active ? style.activeText : 'text-thiso-800'}`}>{brand.displayName}</p>
                        <p className="text-xs text-thiso-400 mt-0.5">{brand.description || fb.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all
                        ${active ? style.activeBorder : 'border-thiso-200'}`}>
                        {active && <div className="w-full h-full rounded-full bg-current opacity-60" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {fieldErrors.receivingUnit && <FieldError text={fieldErrors.receivingUnit} />}
            </div>

            {/* Goods type — appears after unit selected */}
            {form.receivingUnit && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="label">Loại hàng bạn giao <span className="text-red-400">*</span></p>
                {!unitCfg && <p className="text-xs text-thiso-400 py-2">Đang tải...</p>}
                {unitCfg && (
                  customGoodsTypes.length > 0 ? (
                    /* Custom goods types defined by admin */
                    <div className="grid grid-cols-2 gap-3">
                      {customGoodsTypes.map(ct => (
                        <button
                          key={ct.id}
                          type="button"
                          onClick={() => { set('goodsType', ct.baseType); set('unitGoodsTypeId', ct.id); set('vehicleType', ''); }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all
                            ${form.unitGoodsTypeId === ct.id
                              ? 'border-sky-400 bg-sky-50 shadow-card-md'
                              : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                        >
                          <div className="text-2xl mb-2">{ct.emoji}</div>
                          <p className="font-bold text-sm text-thiso-800">{ct.name}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Fallback: default categories when no custom types configured */
                    <div className="grid grid-cols-2 gap-3">
                      {unitCfg.freshFoodEnabled && (
                        <button
                          type="button"
                          onClick={() => { set('goodsType', 'FRESH_FOOD'); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all
                            ${form.goodsType === 'FRESH_FOOD' && !form.unitGoodsTypeId
                              ? 'border-sky-400 bg-sky-50 shadow-card-md'
                              : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                        >
                          <div className="text-2xl mb-2">🥬</div>
                          <p className="font-bold text-sm text-thiso-800">Hàng tươi sống</p>
                          {unitCfg.sundayFreshFoodOnly && (
                            <span className="inline-block mt-1 text-[10px] bg-sky-100 text-sky-600 px-1.5 py-0.5 rounded-full">Cả Chủ nhật</span>
                          )}
                        </button>
                      )}
                      {unitCfg.generalGoodsEnabled && (
                        <button
                          type="button"
                          onClick={() => { set('goodsType', 'GENERAL_GOODS'); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all
                            ${form.goodsType === 'GENERAL_GOODS' && !form.unitGoodsTypeId
                              ? 'border-thiso-500 bg-thiso-100 shadow-card-md'
                              : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                        >
                          <div className="text-2xl mb-2">📦</div>
                          <p className="font-bold text-sm text-thiso-800">Hàng thường</p>
                          {unitCfg.sundayFreshFoodOnly && (
                            <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Không nhận CN</span>
                          )}
                        </button>
                      )}
                      {unitCfg.thiCongEnabled && (
                        <button
                          type="button"
                          onClick={() => { set('goodsType', 'THI_CONG'); set('unitGoodsTypeId', ''); set('vehicleType', ''); }}
                          className={`p-4 rounded-2xl border-2 text-left transition-all
                            ${form.goodsType === 'THI_CONG' && !form.unitGoodsTypeId
                              ? 'border-amber-400 bg-amber-50 shadow-card-md'
                              : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                        >
                          <div className="text-2xl mb-2">🔨</div>
                          <p className="font-bold text-sm text-thiso-800">Thi công</p>
                          <span className="inline-block mt-1 text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">Công trình</span>
                        </button>
                      )}
                    </div>
                  )
                )}
                {fieldErrors.goodsType && <FieldError text={fieldErrors.goodsType} />}
              </div>
            )}

            {/* Vehicle type — appears after goods selected */}
            {form.goodsType && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                <p className="label">Loại phương tiện <span className="text-red-400">*</span></p>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.keys(VEHICLE_INFO) as VehicleType[]).map((v) => {
                    const info = VEHICLE_INFO[v];
                    const active = form.vehicleType === v;
                    const mins = v === 'TRUCK' ? unitCfg?.truckSlotMinutes : v === 'MOTORBIKE' ? unitCfg?.motorbikeSlotMinutes : null;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => set('vehicleType', v)}
                        className={`p-3.5 rounded-2xl border-2 text-center transition-all
                          ${active
                            ? `${info.activeBorder} ${info.activeBg} shadow-card-md scale-[1.03]`
                            : 'border-thiso-200 bg-white hover:border-thiso-300'}`}
                      >
                        <div className="text-2xl mb-1.5">{info.icon}</div>
                        <p className="font-bold text-xs text-thiso-800">{info.label}</p>
                        {mins && <p className="text-[10px] text-thiso-400 mt-0.5">{mins} phút</p>}
                      </button>
                    );
                  })}
                </div>
                <FieldHint text={form.vehicleType && VEHICLE_INFO[form.vehicleType] ? VEHICLE_INFO[form.vehicleType].hint : 'Chọn đúng loại để hệ thống xếp đúng bãi'} />
                {fieldErrors.vehicleType && <FieldError text={fieldErrors.vehicleType} />}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Driver info ── */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Saved info notice */}
            {(form.driverName || form.vehiclePlate) && (
              <div className="flex items-center gap-2.5 bg-sky-50 border border-sky-200 rounded-xl p-3">
                <span className="text-sky-500">💾</span>
                <p className="text-xs text-sky-700">Đã điền sẵn thông tin từ lần trước. Kiểm tra lại và chỉnh nếu cần.</p>
              </div>
            )}

            {/* Plate */}
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

            {/* Driver name */}
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

            {/* Phone */}
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

            {/* Divider */}
            <div className="border-t border-thiso-100 pt-1">
              <p className="text-[11px] text-thiso-400 font-semibold uppercase tracking-wider mb-4">Thông tin đơn hàng</p>
            </div>

            {/* Vendor name */}
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

            {/* PO / Construction code (required) */}
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

            {/* Remember toggle */}
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
        )}

        {/* ── STEP 3: Date & Time ── */}
        {step === 3 && (
          <div className="space-y-5">
            {/* Date chips */}
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

            {/* Slot meta info */}
            {unitCfg && form.vehicleType && (
              <div className="flex items-center gap-2 text-xs text-thiso-500 bg-thiso-50 rounded-xl px-3 py-2.5 border border-thiso-100">
                <span>ℹ</span>
                <span>
                  Mỗi slot <strong>{slotMinutes} phút</strong> — tối đa <strong>{maxPerSlot} xe</strong>/slot
                  {form.goodsType === 'FRESH_FOOD' ? ' · Hàng tươi được ưu tiên gọi trước' : ''}
                </span>
              </div>
            )}

            {/* Time slots */}
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

              {!slotsLoading && slots.length > 0 && (
                <>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1">
                    {slots.map((s) => {
                      const selected = form.timeSlot === s.time;
                      const available = !s.isPast && s.available;
                      const remaining = s.maxPerSlot - s.booked;

                      let cls = '';
                      if (s.isPast)      cls = 'border-thiso-100 bg-thiso-50 text-thiso-300 cursor-not-allowed opacity-50';
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

                  {/* Legend */}
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

              {fieldErrors.timeSlot && <FieldError text={fieldErrors.timeSlot} />}
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Summary card */}
            <div className="bg-white rounded-2xl border border-thiso-100 shadow-card overflow-hidden">
              {/* Header */}
              <div className="bg-thiso-800 px-4 py-3">
                <p className="text-xs text-thiso-400 font-semibold uppercase tracking-wider">Tóm tắt đăng ký</p>
              </div>
              <div className="divide-y divide-thiso-100">
                {[
                  { icon: '🏢', label: 'Đơn vị nhận', value: `${UNIT_FALLBACKS[form.receivingUnit as Unit]?.icon ?? ''} ${(brandUnits[form.receivingUnit as Unit] ?? UNIT_FALLBACKS[form.receivingUnit as Unit])?.displayName ?? form.receivingUnit}` },
                  { icon: '📦', label: 'Loại hàng',   value: GOODS_LABEL[form.goodsType] ?? form.goodsType },
                  { icon: '🚗', label: 'Biển số xe',  value: form.vehiclePlate, mono: true },
                  { icon: VEHICLE_INFO[form.vehicleType as VehicleType]?.icon ?? '🚗', label: 'Loại xe', value: VEHICLE_INFO[form.vehicleType as VehicleType]?.label ?? form.vehicleType },
                  { icon: '👤', label: 'Tài xế',      value: form.driverName },
                  { icon: '📞', label: 'Điện thoại',  value: form.driverPhone, mono: true },
                  { icon: '🏭', label: 'Nhà cung cấp',value: form.vendorName },
                  { icon: '📋', label: 'Số PO / Mã thi công', value: form.poNumber, mono: true as const },
                  { icon: '📅', label: 'Ngày giao',   value: form.deliveryDate.split('-').reverse().join('/') },
                  { icon: '🕐', label: 'Giờ giao',    value: form.timeSlot, mono: true },
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
            </div>

            {/* Edit shortcut */}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 py-2 text-xs text-thiso-500 bg-white border border-thiso-200 rounded-xl hover:bg-thiso-50 transition-colors">
                ✏ Sửa điểm giao
              </button>
              <button onClick={() => setStep(2)} className="flex-1 py-2 text-xs text-thiso-500 bg-white border border-thiso-200 rounded-xl hover:bg-thiso-50 transition-colors">
                ✏ Sửa thông tin xe
              </button>
              <button onClick={() => setStep(3)} className="flex-1 py-2 text-xs text-thiso-500 bg-white border border-thiso-200 rounded-xl hover:bg-thiso-50 transition-colors">
                ✏ Sửa giờ giao
              </button>
            </div>

            {/* Note */}
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

            {/* Submit error */}
            {submitError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
                <span>⚠</span><span>{submitError}</span>
              </div>
            )}

            {/* Privacy note */}
            <p className="text-[11px] text-thiso-300 text-center leading-relaxed">
              Thông tin đăng ký chỉ dùng cho mục đích quản lý giao hàng tại mall.
              Bằng cách nhấn "Hoàn tất đăng ký" bạn đồng ý với điều này.
            </p>
          </div>
        )}
      </div>

      {/* ── Fixed bottom navigation ───────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-thiso-100 px-4 pt-3"
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))' }}
      >
        <div className="flex gap-3 max-w-xl mx-auto">
          {step > 1 && (
            <button
              type="button"
              onClick={back}
              className="h-12 px-5 rounded-xl border-2 border-thiso-200 text-thiso-600 font-bold text-sm hover:bg-thiso-50 transition-colors flex-shrink-0"
            >
              ← Quay lại
            </button>
          )}

          {step < 4 && (
            <button
              type="button"
              onClick={next}
              className="h-12 flex-1 rounded-xl bg-thiso-800 text-white font-bold text-base hover:bg-thiso-900 transition-colors active:scale-[0.98]"
            >
              Tiếp theo →
            </button>
          )}

          {step === 4 && (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-14 flex-1 rounded-xl bg-sky-600 text-white font-black text-base hover:bg-sky-700 transition-colors disabled:opacity-50 active:scale-[0.98] shadow-card-md"
            >
              {submitting
                ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span> Đang xử lý...</span>
                : '✓ Hoàn tất đăng ký'
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
