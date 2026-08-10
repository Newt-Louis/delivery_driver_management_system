import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { CameraIcon, ArrowRightIcon } from '../components/Icon';

function normalizeOrderCode(value: string) {
  return value.trim().replace(/[^A-Za-z0-9]/g, '');
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const { mall } = useBranding();
  const [orderCode, setOrderCode] = useState('');
  const [message, setMessage] = useState('');

  const normalizedCode = useMemo(() => normalizeOrderCode(orderCode), [orderCode]);
  const codeLooksSupported = /^PO\d{10}$/.test(normalizedCode) || /^[A-Za-z0-9]{5}$/.test(normalizedCode);
  const staffHomePath = user?.role === 'CHECKIN' ? '/check-in' : '/dashboard';

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedCode) {
      setMessage('Vui lòng nhập mã PO hoặc mã Thi Công.');
      return;
    }
    if (!codeLooksSupported) {
      setMessage('Mã PO cần có dạng PO + 10 chữ số, mã Thi Công gồm 5 ký tự chữ/số.');
      return;
    }
    setMessage('Luồng xác thực API sẽ được kết nối tại trang chủ này trong bước phát triển tiếp theo.');
  }

  return (
    <main className="min-h-screen bg-thiso-50 text-thiso-800">
      <section className="border-b border-thiso-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            {mall.logoUrl ? (
              <img src={mall.logoUrl} alt={mall.mallName} className="h-10 w-10 flex-shrink-0 rounded-lg border border-thiso-100 bg-white object-contain p-1" />
            ) : (
              <img src="/truck.svg" alt="Delivery" className="h-10 w-10 flex-shrink-0 rounded-lg" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-widest text-thiso-900">{mall.mallName}</p>
              <p className="truncate text-xs font-semibold text-thiso-400">{mall.tagline ?? 'Delivery Management System'}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <Link to="/track" className="btn btn-ghost h-10 px-3">
              Theo dõi
            </Link>
            {isAuthenticated ? (
              <Link to={staffHomePath} className="btn btn-primary h-10 px-3">
                Vận hành
              </Link>
            ) : (
              <Link to="/login" className="btn btn-secondary h-10 px-3">
                Nhân viên
              </Link>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-3xl justify-items-center gap-8 px-4 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="w-full space-y-6">
          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-black leading-tight text-thiso-900 sm:text-4xl">
              Hệ thống điều phối giao hàng THISO
            </h1>
            <p className="max-w-2xl text-base leading-7 text-thiso-500">
              Nhập mã PO hoặc mã Thi Công để chuẩn bị đăng ký giao hàng online. Khi API xác thực được cấu hình, hệ thống sẽ tự lấy thông tin đơn vị nhận, loại hàng và phương tiện từ mã này.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="max-w-2xl rounded-lg border border-thiso-100 bg-white p-4 shadow-card-md sm:p-5">
            <label htmlFor="home-order-code" className="label">
              Mã PO / Thi Công
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <input
                  id="home-order-code"
                  type="text"
                  value={orderCode}
                  onChange={(event) => {
                    setOrderCode(event.target.value.toUpperCase().replace(/\s/g, ''));
                    setMessage('');
                  }}
                  placeholder="VD: PO0123456789 hoặc A1B2C"
                  autoComplete="off"
                  autoCapitalize="characters"
                  className="input h-12 pr-12 font-mono text-base tracking-wide"
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="button"
                  onClick={() => setMessage('Quét QR bằng camera sẽ được bật khi triển khai bước xác thực API.')}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-thiso-500 transition-colors hover:bg-thiso-100 hover:text-thiso-900"
                  aria-label="Quét mã bằng camera"
                  title="Quét mã bằng camera"
                >
                  <CameraIcon />
                </button>
              </div>
              <button type="submit" className="btn btn-primary h-12 w-full shrink-0 justify-center gap-2 px-4 sm:w-auto">
                <span>Kiểm tra</span>
                <ArrowRightIcon />
              </button>
            </div>
            {normalizedCode && (
              <p className={`mt-2 text-xs font-semibold ${codeLooksSupported ? 'text-sky-700' : 'text-amber-600'}`}>
                Mã chuẩn hóa: <span className="font-mono">{normalizedCode}</span>
              </p>
            )}
            {message && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {message}
              </div>
            )}
          </form>

          <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
            <Link to="/register" className="rounded-lg border border-thiso-200 bg-white p-4 shadow-card transition-all hover:border-thiso-400 hover:shadow-card-md">
              <p className="text-sm font-black text-thiso-900">Đăng ký thủ công</p>
              <p className="mt-1 text-sm leading-6 text-thiso-500">Dùng cho bản giấy hoặc khi hệ thống xác thực online gặp sự cố.</p>
            </Link>
            <Link to="/track" className="rounded-lg border border-thiso-200 bg-white p-4 shadow-card transition-all hover:border-thiso-400 hover:shadow-card-md">
              <p className="text-sm font-black text-thiso-900">Theo dõi đơn</p>
              <p className="mt-1 text-sm leading-6 text-thiso-500">Tra cứu trạng thái bằng mã đăng ký hoặc biển số xe sau khi đăng ký.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
