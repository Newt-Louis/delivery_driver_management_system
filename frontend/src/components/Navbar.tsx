import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN_LOC: 'Admin khu vực',
  ADMIN_OPE: 'Admin vận hành',
  RECEIVING: 'Nhận hàng',
  CHECKIN: 'Check-in',
};

interface NavItem { to: string; label: string; icon: string; roles: string[] | null }
interface NavGroup { heading: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Vận hành',
    items: [
      { to: '/dashboard', label: 'Điều phối',      icon: '📋', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'] },
      { to: '/docks',     label: 'Quản lý dock',   icon: '🚧', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'] },
      { to: '/check-in',  label: 'Check-in',        icon: '✅', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN'] },
    ],
  },
  {
    heading: 'Màn hình & Tài xế',
    items: [
      { to: '/waiting-screen', label: 'Màn hình chờ (TV)',    icon: '📺', roles: null },
      { to: '/register',       label: 'Đăng ký giao hàng',    icon: '📝', roles: null },
      { to: '/track',          label: 'Theo dõi tài xế',      icon: '🚛', roles: null },
    ],
  },
  {
    heading: 'Phân tích',
    items: [
      { to: '/receiving-times', label: 'Thời gian nhận hàng', icon: '⏱', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'] },
      { to: '/reports',         label: 'Báo cáo',              icon: '📈', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'] },
      { to: '/histories',       label: 'Lịch sử',              icon: '📜', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'] },
    ],
  },
  {
    heading: 'Quản trị',
    items: [
      { to: '/backoffice', label: 'Backoffice', icon: '⚙', roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'] },
    ],
  },
];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Navbar() {
  const { user, logout, hasRole } = useAuth();
  const { mall } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() { logout(); navigate('/login'); }

  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((l) => !l.roles || hasRole(...l.roles)),
  })).filter((g) => g.items.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <Link to="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          {mall.logoUrl ? (
            <img src={mall.logoUrl} alt={mall.mallName}
              className="w-9 h-9 rounded-xl object-contain bg-white/10 p-0.5 flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sky-300 font-black text-lg leading-none">{mall.mallName.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className="text-white font-black text-sm tracking-widest truncate">{mall.mallName}</div>
            <div className="text-thiso-400 text-[10px] tracking-wider truncate">{mall.tagline ?? 'DELIVERY SYSTEM'}</div>
          </div>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {visibleGroups.map((g) => (
          <div key={g.heading} className="mb-4">
            <div className="px-3 mb-1 text-[10px] font-bold text-thiso-500 uppercase tracking-widest">
              {g.heading}
            </div>
            {g.items.map((l) => {
              const isActive = location.pathname === l.to || (l.to !== '/' && location.pathname.startsWith(l.to));
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-thiso-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`text-base w-5 text-center transition-transform ${isActive ? '' : 'group-hover:scale-110'}`}>
                    {l.icon}
                  </span>
                  <span className="truncate">{l.label}</span>
                  {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User section */}
      {user && (
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-sky-500/30 flex items-center justify-center text-xs font-black text-sky-300 flex-shrink-0">
              {initials(user.name)}
            </div>
            <div className="min-w-0">
              <div className="text-white text-sm font-semibold truncate leading-none">{user.name}</div>
              <div className="text-thiso-400 text-[11px] mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-thiso-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <span className="text-base w-5 text-center">↩</span>
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-56 bg-thiso-900 flex-col z-30 shadow-xl">
        {sidebarContent}
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-thiso-900 flex items-center px-3 z-40 shadow-md">
        <button
          onClick={() => setOpen(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-thiso-300 hover:bg-white/10 transition-colors mr-2"
          aria-label="Mở menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link to="/" className="flex items-center gap-2 flex-1 min-w-0">
          {mall.logoUrl ? (
            <img src={mall.logoUrl} alt={mall.mallName} className="w-7 h-7 rounded-lg object-contain bg-white/10 p-0.5 flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-sky-300 font-black text-sm leading-none">{mall.mallName.charAt(0)}</span>
            </div>
          )}
          <span className="text-white font-black text-sm tracking-widest truncate">{mall.mallName}</span>
        </Link>
        {user && (
          <div className="w-8 h-8 rounded-full bg-sky-500/30 flex items-center justify-center text-xs font-black text-sky-300 flex-shrink-0">
            {initials(user.name)}
          </div>
        )}
      </div>

      {/* ── Mobile overlay + slide-in drawer ── */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`md:hidden fixed top-0 left-0 bottom-0 w-64 bg-thiso-900 z-50 flex flex-col shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button */}
        <div className="flex justify-end px-3 pt-3">
          <button
            onClick={() => setOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-thiso-400 hover:text-white hover:bg-white/10 transition-colors text-lg"
          >
            ×
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}
