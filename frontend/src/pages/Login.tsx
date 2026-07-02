import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import api from '../lib/api';

function homePathForRole(role?: string) {
  if (role === 'CHECKIN') return '/check-in';
  return '/dashboard';
}

export default function Login() {
  const { login, isAuthenticated, user } = useAuth();
  const { mall, units } = useBranding();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to={homePathForRole(user?.role)} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate(homePathForRole(res.data.user?.role));
    } catch {
      setError('Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-thiso-800 flex items-center justify-center px-4">
      {/* Background texture */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 25% 25%, #fff 1px, transparent 1px), radial-gradient(circle at 75% 75%, #fff 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-8">
          {mall.logoUrl ? (
            <img src={mall.logoUrl} alt={mall.mallName} className="w-20 h-20 rounded-2xl object-contain bg-white/10 mx-auto mb-4 p-1" />
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 mb-4">
              <span className="text-3xl font-black text-white">{mall.mallName.charAt(0)}</span>
            </div>
          )}
          <div className="text-white font-black text-2xl tracking-widest mb-1">{mall.mallName}</div>
          <div className="text-thiso-400 text-sm tracking-wider uppercase">{mall.tagline ?? 'Delivery Management System'}</div>

          <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
            {(['EMART', 'THISKYHALL', 'TENANT'] as const).map((u) => (
              <div key={u} className="flex items-center gap-1.5 bg-white/10 rounded-lg px-2.5 py-1">
                {units[u]?.logoUrl ? (
                  <img src={units[u].logoUrl!} alt={units[u].shortName} className="w-4 h-4 rounded object-contain" />
                ) : null}
                <span className="text-[11px] font-bold text-white tracking-wider">{units[u]?.shortName?.toUpperCase() || u}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-card-lg p-8">
          <h2 className="text-lg font-bold text-thiso-800 mb-6">Đăng nhập</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mall.com"
                required
              />
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full py-2.5 mt-2" disabled={loading}>
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-thiso-100">
            <p className="text-xs font-semibold text-thiso-400 uppercase tracking-wide mb-3">Tài khoản demo</p>
            <div className="space-y-1.5">
              {[
                { label: 'Superadmin', email: 'superadmin@mall.com' },
                { label: 'Admin khu vực', email: 'admin@mall.com' },
                { label: 'Vận hành', email: 'operator@mall.com' },
                { label: 'Nhận hàng', email: 'receiving@mall.com' },
                { label: 'Check-in', email: 'checkin@mall.com' },
              ].map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => { setEmail(a.email); setPassword('password123'); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-thiso-50 hover:bg-thiso-100 transition-colors text-xs text-left"
                >
                  <span className="font-semibold text-thiso-700">{a.label}</span>
                  <span className="text-thiso-400 font-mono">{a.email}</span>
                </button>
              ))}
              <p className="text-xs text-thiso-300 text-center mt-2">Mật khẩu: password123</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
