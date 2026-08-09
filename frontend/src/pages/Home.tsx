import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

function CameraIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.4-1.9A2 2 0 0 1 11 3.3h2a2 2 0 0 1 1.6.8L16 6h1.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0Z" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.5 10.5V20h13v-9.5" />
    </svg>
  );
}

function normalizeOrderCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const { mall } = useBranding();
  const [orderCode, setOrderCode] = useState('');
  const [message, setMessage] = useState('');

  const normalizedCode = useMemo(() => normalizeOrderCode(orderCode), [orderCode]);
  const codeLooksSupported = /^PO\d{10}$/.test(normalizedCode) || /^[A-Z0-9]{5}$/.test(normalizedCode);
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

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:py-12">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800">
              <HomeIcon />
              Trang chủ giao hàng
            </div>
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
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <button type="submit" className="btn btn-primary h-12 shrink-0 gap-2 px-4">
                <span className="hidden sm:inline">Kiểm tra</span>
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

        <aside className="rounded-lg border border-thiso-100 bg-white p-5 shadow-card-md">
          <img src="/truck.svg" alt="Delivery truck" className="mb-5 h-20 w-20 rounded-2xl" />
          <div className="space-y-4">
            <div>
              <p className="section-heading">Luồng mặc định mới</p>
              <p className="mt-1 text-sm leading-6 text-thiso-600">
                Domain gốc `/` sẽ là nơi bắt đầu đăng ký online bằng mã PO/Thi Công.
              </p>
            </div>
            <div className="divider" />
            <div>
              <p className="section-heading">Luồng dự phòng</p>
              <p className="mt-1 text-sm leading-6 text-thiso-600">
                `/register` tiếp tục giữ màn hình đăng ký hiện tại để nhân viên hoặc tài xế nhập thủ công.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
