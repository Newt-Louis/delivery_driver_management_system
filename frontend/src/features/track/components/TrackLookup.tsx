import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { looksLikeCode } from '../utils';

export default function TrackLookup() {
  const navigate = useNavigate();
  const [input, setInput]       = useState('');
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = input.trim().toUpperCase();
    if (!val) return;
    setError('');
    setChecking(true);
    try {
      if (looksLikeCode(val)) {
        await api.get(`/api/track/${val}`);
        navigate(`/track/${val}`);
      } else {
        const res = await api.get<{ registrationCode: string }>('/api/track/search', { params: { plate: val } });
        navigate(`/track/${res.data.registrationCode}`);
      }
    } catch {
      setError('Không tìm thấy. Kiểm tra lại mã đăng ký hoặc biển số xe.');
      setChecking(false);
    }
  }

  return (
    <div className="min-h-screen bg-thiso-900 flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🚛</div>
          <h1 className="text-white font-black text-xl mb-1">Theo dõi giao hàng</h1>
          <p className="text-thiso-400 text-sm">Nhập mã đăng ký hoặc biển số xe</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-xl space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(''); }}
            placeholder="Mã đăng ký hoặc biển số xe..."
            className="w-full border-2 border-thiso-200 rounded-xl px-4 py-3.5 text-base font-mono font-black tracking-widest text-thiso-900 placeholder:text-thiso-300 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-thiso-500 transition-colors"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            style={{ fontSize: '16px' }}
          />
          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
              <span>⚠</span> {error}
            </div>
          )}
          <button
            type="submit"
            disabled={!input.trim() || checking}
            className="w-full py-3.5 rounded-xl font-black text-white text-base transition-all bg-thiso-800 hover:bg-thiso-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            {checking ? 'Đang tìm...' : 'Xem trạng thái →'}
          </button>
          <p className="text-center text-[11px] text-thiso-400">
            Chưa đăng ký?{' '}
            <a href="/register" className="text-thiso-600 underline font-semibold">Đăng ký ngay</a>
          </p>
          <p className="text-center text-[11px] text-thiso-400">
            Nhập sai thông tin? Muốn{' '}
            <Link to="/cancelled" className="text-red-600 underline font-semibold">hủy chuyến</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
