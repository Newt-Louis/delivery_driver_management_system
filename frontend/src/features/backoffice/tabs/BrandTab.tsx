import { useCallback, useRef, useState } from 'react';
import api from '../../../lib/api';
import { useBranding, UNIT_FALLBACKS } from '../../../context/BrandingContext';

type ReceivingUnitKey = 'EMART' | 'THISKYHALL' | 'TENANT';

function LogoUpload({ value, onChange, label, maxSizeKB = 500, variant = 'logo' }: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  maxSizeKB?: number;
  variant?: 'logo' | 'bg';
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > maxSizeKB * 1000) { alert(`File quá lớn — tối đa ${maxSizeKB}KB`); return; }
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [onChange, maxSizeKB]);

  const isBg = variant === 'bg';

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border-2 border-thiso-200 bg-thiso-50 flex items-center justify-center overflow-hidden flex-shrink-0
          ${isBg ? 'w-40 h-24' : 'w-16 h-16'}`}>
          {value
            ? <img src={value} alt="preview" className={`w-full h-full ${isBg ? 'object-cover' : 'object-contain p-1'}`} />
            : <span className="text-2xl text-thiso-300">🖼</span>}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => inputRef.current?.click()}>
            {value ? (isBg ? 'Thay ảnh' : 'Thay logo') : (isBg ? 'Tải lên ảnh' : 'Tải lên logo')}
          </button>
          {value && (
            <button type="button" className="text-xs text-red-500 hover:text-red-700 text-left" onClick={() => onChange(null)}>
              Xóa
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          {isBg
            ? <p className="text-[11px] text-thiso-400 leading-relaxed">JPG, PNG — tối đa {maxSizeKB}KB<br/>Khuyến nghị 1920×1080, ảnh sẽ phủ toàn màn hình kiosk</p>
            : <p className="text-[11px] text-thiso-400 leading-relaxed">PNG, JPG, SVG — tối đa {maxSizeKB}KB<br/>Nền trong suốt (PNG) hiển thị tốt hơn</p>}
        </div>
      </div>
    </div>
  );
}

export default function BrandTab() {
  const { mall, units, refresh } = useBranding();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<string | null>(null);

  // Mall state
  const [mallName,    setMallName]    = useState(mall.mallName);
  const [mallTagline, setMallTagline] = useState(mall.tagline ?? '');
  const [mallLogo,    setMallLogo]    = useState<string | null>(mall.logoUrl);
  const [kioskBgUrl,  setKioskBgUrl]  = useState<string | null>(mall.kioskBgUrl ?? null);

  // Unit states
  const [unitData, setUnitData] = useState<Record<ReceivingUnitKey, {
    displayName: string; shortName: string; description: string;
    logoUrl: string | null; primaryColor: string;
  }>>({
    EMART:      { displayName: units.EMART?.displayName      ?? '', shortName: units.EMART?.shortName      ?? '', description: units.EMART?.description      ?? '', logoUrl: units.EMART?.logoUrl      ?? null, primaryColor: units.EMART?.primaryColor      ?? '#FF9500' },
    THISKYHALL: { displayName: units.THISKYHALL?.displayName ?? '', shortName: units.THISKYHALL?.shortName ?? '', description: units.THISKYHALL?.description ?? '', logoUrl: units.THISKYHALL?.logoUrl ?? null, primaryColor: units.THISKYHALL?.primaryColor ?? '#27A55E' },
    TENANT:     { displayName: units.TENANT?.displayName     ?? '', shortName: units.TENANT?.shortName     ?? '', description: units.TENANT?.description     ?? '', logoUrl: units.TENANT?.logoUrl     ?? null, primaryColor: units.TENANT?.primaryColor     ?? '#1C1C1C' },
  });

  function setUnit(unit: ReceivingUnitKey, field: string, value: string | null) {
    setUnitData(d => ({ ...d, [unit]: { ...d[unit], [field]: value } }));
  }

  async function saveMall() {
    setSaving('mall');
    try {
      await api.patch('/api/brand/mall', { mallName, tagline: mallTagline || null, logoUrl: mallLogo, kioskBgUrl });
      refresh();
      setSaved('mall'); setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  async function saveUnit(unit: ReceivingUnitKey) {
    setSaving(unit);
    try {
      await api.patch(`/api/units/${unit}/config`, unitData[unit]);
      refresh();
      setSaved(unit); setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  const UNIT_STYLE_BG: Record<ReceivingUnitKey, string> = {
    EMART: 'bg-emart-50 border-emart-200', THISKYHALL: 'bg-sky-50 border-sky-200', TENANT: 'bg-thiso-50 border-thiso-200',
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-thiso-400">Cấu hình logo và tên hiển thị cho công ty và từng đơn vị. Logo sẽ xuất hiện trong trang đăng ký, màn hình chờ và phiếu in.</p>

      {/* ── Mall / Company branding ── */}
      <div className="card space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-thiso-100">
          <div className="w-8 h-8 rounded-lg bg-thiso-800 flex items-center justify-center">
            {mallLogo
              ? <img src={mallLogo} alt="" className="w-full h-full object-contain rounded-lg p-0.5" />
              : <span className="text-white font-black text-sm">{mallName.charAt(0)}</span>}
          </div>
          <div>
            <h3 className="font-bold text-thiso-800">Thương hiệu công ty</h3>
            <p className="text-xs text-thiso-400">Logo chính hiển thị trên navbar và màn hình đăng nhập</p>
          </div>
        </div>

        <LogoUpload label="Logo công ty" value={mallLogo} onChange={setMallLogo} />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Tên công ty</label>
            <input className="input" value={mallName} onChange={e => setMallName(e.target.value)} placeholder="THISO GROUP" />
          </div>
          <div>
            <label className="label">Tagline / Mô tả ngắn</label>
            <input className="input" value={mallTagline} onChange={e => setMallTagline(e.target.value)} placeholder="Delivery Management System" />
          </div>
        </div>

        <div className="border-t border-thiso-100 pt-5">
          <h4 className="font-semibold text-thiso-700 text-sm mb-1">🖥 Hình nền màn hình Kiosk</h4>
          <p className="text-[11px] text-thiso-400 mb-3">Hiển thị ở chế độ idle khi không có kết quả quét. Để trống = nền tối mặc định.</p>
          <LogoUpload label="" value={kioskBgUrl} onChange={setKioskBgUrl} maxSizeKB={2048} variant="bg" />
        </div>

        <div className="flex items-center justify-end gap-3">
          {saved === 'mall' && <span className="text-xs text-sky-600 font-semibold">✓ Đã lưu</span>}
          <button className="btn-primary px-6" onClick={saveMall} disabled={saving === 'mall'}>
            {saving === 'mall' ? 'Đang lưu...' : 'Lưu thương hiệu công ty'}
          </button>
        </div>
      </div>

      {/* ── Per-unit branding ── */}
      <div className="space-y-5">
        <h3 className="font-bold text-thiso-700">Thương hiệu từng đơn vị</h3>
        {(['EMART', 'THISKYHALL', 'TENANT'] as ReceivingUnitKey[]).map((unit) => {
          const d  = unitData[unit];
          const fb = UNIT_FALLBACKS[unit];
          return (
            <div key={unit} className={`border rounded-2xl p-5 space-y-4 ${UNIT_STYLE_BG[unit]}`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-thiso-100 flex items-center justify-center overflow-hidden">
                  {d.logoUrl
                    ? <img src={d.logoUrl} alt="" className="w-full h-full object-contain p-1" />
                    : <span className="text-2xl">{fb.icon}</span>}
                </div>
                <div>
                  <h4 className="font-bold text-thiso-800">{d.displayName || fb.displayName}</h4>
                  <p className="text-xs text-thiso-400 font-mono">{unit}</p>
                </div>
              </div>

              <LogoUpload label="Logo đơn vị" value={d.logoUrl} onChange={v => setUnit(unit, 'logoUrl', v)} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tên hiển thị đầy đủ</label>
                  <input className="input bg-white" value={d.displayName} onChange={e => setUnit(unit, 'displayName', e.target.value)} placeholder={fb.displayName} />
                </div>
                <div>
                  <label className="label">Tên rút gọn</label>
                  <input className="input bg-white" value={d.shortName} onChange={e => setUnit(unit, 'shortName', e.target.value)} placeholder={fb.shortName} />
                  <p className="text-[11px] text-thiso-400 mt-1">Dùng trên màn hình TV hàng chờ</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="label">Mô tả / địa chỉ cổng</label>
                  <input className="input bg-white" value={d.description} onChange={e => setUnit(unit, 'description', e.target.value)} placeholder={fb.description} />
                  <p className="text-[11px] text-thiso-400 mt-1">Ví dụ: Siêu thị — Cửa B3, tầng hầm</p>
                </div>
                <div>
                  <label className="label">Màu thương hiệu</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={d.primaryColor}
                      onChange={e => setUnit(unit, 'primaryColor', e.target.value)}
                      className="w-10 h-10 rounded-lg border border-thiso-200 cursor-pointer bg-white p-0.5"
                    />
                    <input
                      className="input bg-white font-mono text-sm flex-1"
                      value={d.primaryColor}
                      onChange={e => setUnit(unit, 'primaryColor', e.target.value)}
                      placeholder="#FF9500"
                      pattern="^#[0-9a-fA-F]{6}$"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                {saved === unit && <span className="text-xs text-sky-600 font-semibold">✓ Đã lưu</span>}
                <button className="btn-primary text-sm px-5" onClick={() => saveUnit(unit)} disabled={saving === unit}>
                  {saving === unit ? 'Đang lưu...' : `Lưu ${d.displayName || unit}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

