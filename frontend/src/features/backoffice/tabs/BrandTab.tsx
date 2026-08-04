import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useBranding } from '../../../context/BrandingContext';
import type { UnitConfig } from '../../../lib/types';

function LogoUpload({ value, onChange, label, maxSizeKB = 500 }: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  maxSizeKB?: number;
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

  return (
    <div>
      <p className="label">{label}</p>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl border-2 border-thiso-200 bg-thiso-50 flex items-center justify-center overflow-hidden flex-shrink-0
          w-16 h-16`}>
          {value
            ? <img src={value} alt="preview" className="w-full h-full object-contain p-1" />
            : <span className="text-2xl text-thiso-300">🖼</span>}
        </div>
        <div className="flex flex-col gap-1.5 pt-1">
          <button type="button" className="btn-secondary text-xs py-1.5 px-3" onClick={() => inputRef.current?.click()}>
            {value ? 'Thay logo' : 'Tải lên logo'}
          </button>
          {value && (
            <button type="button" className="text-xs text-red-500 hover:text-red-700 text-left" onClick={() => onChange(null)}>
              Xóa
            </button>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-[11px] text-thiso-400 leading-relaxed">PNG, JPG, SVG — tối đa {maxSizeKB}KB<br/>Nền trong suốt (PNG) hiển thị tốt hơn</p>
        </div>
      </div>
    </div>
  );
}

function UnitBrandCard({ unit, onSaved }: { unit: UnitConfig; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    displayName: unit.displayName || unit.unit,
    shortName: unit.shortName || unit.displayName || unit.unit,
    description: unit.description || '',
    icon: unit.icon || '',
    logoUrl: unit.logoUrl ?? null as string | null,
    primaryColor: unit.primaryColor || '#1C1C1C',
  });

  function setField(field: keyof typeof form, value: string | null) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveUnit() {
    setSaving(true);
    try {
      await api.patch(`/api/units/${unit.unit}/config`, form);
      onSaved();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border rounded-2xl p-5 space-y-4 bg-white border-thiso-100">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl border border-thiso-100 flex items-center justify-center overflow-hidden" style={{ background: `${form.primaryColor}12` }}>
          {form.logoUrl
            ? <img src={form.logoUrl} alt="" className="w-full h-full object-contain p-1" />
            : <span className="text-2xl">{form.icon || '🏬'}</span>}
        </div>
        <div>
          <h4 className="font-bold text-thiso-800">{form.displayName || unit.unit}</h4>
          <p className="text-xs text-thiso-400 font-mono">{unit.unit}</p>
        </div>
      </div>

      <LogoUpload label="Logo đơn vị" value={form.logoUrl} onChange={v => setField('logoUrl', v)} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tên hiển thị đầy đủ</label>
          <input className="input bg-white" value={form.displayName} onChange={e => setField('displayName', e.target.value)} placeholder={unit.unit} />
        </div>
        <div>
          <label className="label">Tên rút gọn</label>
          <input className="input bg-white" value={form.shortName} onChange={e => setField('shortName', e.target.value)} placeholder={unit.unit} />
          <p className="text-[11px] text-thiso-400 mt-1">Dùng trên màn hình TV hàng chờ</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Icon</label>
          <input
            className="input bg-white"
            value={form.icon}
            onChange={e => setField('icon', e.target.value)}
            placeholder="🏬"
            maxLength={40}
          />
          <p className="text-[11px] text-thiso-400 mt-1">Emoji hoặc class icon, có thể để trống</p>
        </div>
        <div className="col-span-2">
          <label className="label">Mô tả / địa chỉ cổng</label>
          <input className="input bg-white" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Ví dụ: Siêu thị - Cửa B3" />
          <p className="text-[11px] text-thiso-400 mt-1">Ví dụ: Siêu thị — Cửa B3, tầng hầm</p>
        </div>
        <div>
          <label className="label">Màu thương hiệu</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.primaryColor}
              onChange={e => setField('primaryColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-thiso-200 cursor-pointer bg-white p-0.5"
            />
            <input
              className="input bg-white font-mono text-sm flex-1"
              value={form.primaryColor}
              onChange={e => setField('primaryColor', e.target.value)}
              placeholder="#1C1C1C"
              pattern="^#[0-9a-fA-F]{6}$"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        {saved && <span className="text-xs text-sky-600 font-semibold">✓ Đã lưu</span>}
        <button className="btn-primary text-sm px-5" onClick={saveUnit} disabled={saving}>
          {saving ? 'Đang lưu...' : `Lưu ${form.displayName || unit.unit}`}
        </button>
      </div>
    </div>
  );
}

export default function BrandTab() {
  const { mall, refresh } = useBranding();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved,  setSaved]  = useState<string | null>(null);
  const { data: unitConfigs = [], isLoading: unitsLoading } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  // Mall state
  const [mallName,    setMallName]    = useState(mall.mallName);
  const [mallTagline, setMallTagline] = useState(mall.tagline ?? '');
  const [mallLogo,    setMallLogo]    = useState<string | null>(mall.logoUrl);

  async function saveMall() {
    setSaving('mall');
    try {
      await api.patch('/api/brand/mall', { mallName, tagline: mallTagline || null, logoUrl: mallLogo });
      refresh();
      setSaved('mall'); setTimeout(() => setSaved(null), 2000);
    } finally { setSaving(null); }
  }

  function refreshUnits() {
    refresh();
    queryClient.invalidateQueries({ queryKey: ['unit-configs'] });
  }

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
        {unitsLoading && <p className="text-sm text-thiso-400">Đang tải đơn vị...</p>}
        {!unitsLoading && unitConfigs.length === 0 && (
          <div className="border border-thiso-100 bg-white rounded-2xl p-5 text-sm text-thiso-400">
            Khu vực hiện tại chưa có đơn vị nào.
          </div>
        )}
        {unitConfigs.map((unit) => (
          <UnitBrandCard key={unit.id} unit={unit} onSaved={refreshUnits} />
        ))}
      </div>
    </div>
  );
}
