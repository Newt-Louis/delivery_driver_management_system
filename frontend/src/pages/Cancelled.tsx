import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cancelDelivery } from '../features/cancelled/api';

type CancelForm = {
  vehiclePlate: string;
  driverPhone: string;
  poNumber: string;
  registrationCode: string;
  requestedTime: string;
};

const EMPTY_FORM: CancelForm = {
  vehiclePlate: '',
  driverPhone: '',
  poNumber: '',
  registrationCode: '',
  requestedTime: '',
};

function normalizePlate(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function normalizeOrderCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function Cancelled() {
  const [searchParams] = useSearchParams();
  const initialCode = useMemo(() => searchParams.get('code')?.toUpperCase() ?? '', [searchParams]);
  const [form, setForm] = useState<CancelForm>({ ...EMPTY_FORM, registrationCode: initialCode });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function setField<K extends keyof CancelForm>(key: K, value: CancelForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const res = await cancelDelivery({
        vehiclePlate: normalizePlate(form.vehiclePlate),
        driverPhone: normalizePhone(form.driverPhone),
        poNumber: normalizeOrderCode(form.poNumber),
        registrationCode: form.registrationCode.trim().toUpperCase(),
        requestedTime: form.requestedTime,
      });
      setSuccess(res.message || 'Hủy thành công');
      setForm(EMPTY_FORM);
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data;
      setError(data?.message ?? data?.error ?? 'Có thông tin bạn nhập không đúng, vui lòng nhập lại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-thiso-50 flex flex-col">
      <div className="bg-white border-b border-thiso-100 px-4 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-thiso-400 font-bold uppercase tracking-widest">Tài xế</p>
            <h1 className="text-xl font-black text-thiso-900">Hủy chuyến giao hàng</h1>
          </div>
          <Link to="/track" className="text-sm font-semibold text-thiso-500 hover:text-thiso-800">
            Theo dõi
          </Link>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 max-w-md mx-auto w-full">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-thiso-100 shadow-sm p-5 space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3 text-sm text-amber-800">
            Chỉ có thể hủy trước khi check-in tại cổng. Nhập đúng 5 thông tin đã dùng khi đăng ký để hủy lượt giao hàng.
          </div>

          <label className="block">
            <span className="label">Biển số xe</span>
            <input
              value={form.vehiclePlate}
              onChange={(e) => setField('vehiclePlate', e.target.value.toUpperCase())}
              required
              className="input py-3 font-mono tracking-widest"
              placeholder="51C-123.45"
              autoCapitalize="characters"
              autoComplete="off"
              style={{ fontSize: '16px' }}
            />
          </label>

          <label className="block">
            <span className="label">Số điện thoại</span>
            <input
              type="tel"
              inputMode="numeric"
              value={form.driverPhone}
              onChange={(e) => setField('driverPhone', e.target.value.replace(/[^\d+\-\s]/g, ''))}
              required
              className="input py-3"
              placeholder="0901 234 567"
              autoComplete="tel"
              style={{ fontSize: '16px' }}
            />
          </label>

          <label className="block">
            <span className="label">Mã PO/Thi Công</span>
            <input
              value={form.poNumber}
              onChange={(e) => setField('poNumber', e.target.value.toUpperCase().replace(/\s/g, ''))}
              required
              className="input py-3 font-mono"
              placeholder="PO0123456789 hoặc TC0123456789"
              autoComplete="off"
              style={{ fontSize: '16px' }}
            />
          </label>

          <label className="block">
            <span className="label">Mã đăng ký</span>
            <input
              value={form.registrationCode}
              onChange={(e) => setField('registrationCode', e.target.value.toUpperCase().replace(/\s/g, ''))}
              required
              className="input py-3 font-mono tracking-widest"
              placeholder="E260731001"
              autoCapitalize="characters"
              autoComplete="off"
              style={{ fontSize: '16px' }}
            />
          </label>

          <label className="block">
            <span className="label">Ngày giờ giao</span>
            <input
              type="datetime-local"
              value={form.requestedTime}
              onChange={(e) => setField('requestedTime', e.target.value)}
              required
              className="input py-3"
              style={{ fontSize: '16px' }}
            />
          </label>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-3 text-sm font-bold text-green-700">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-red-600 text-white font-black hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Đang hủy...' : 'Hủy chuyến'}
          </button>
        </form>

        <div className="text-center mt-5">
          <Link to="/register" className="text-sm text-thiso-500 underline font-semibold">
            Quay lại đăng ký giao hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
