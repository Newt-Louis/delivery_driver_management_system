import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';

// ─── User Management Panel ───────────────────────────────────────────────────

interface SystemUser {
  id: string; name: string; email: string;
  role: string; unit: string | null; department: string | null;
  businessLocationId: string | null;
  isActive: boolean; createdAt: string;
}

const ROLE_META: Record<string, { label: string; color: string; icon: string }> = {
  SUPERADMIN: { label: 'Superadmin',      color: 'bg-purple-100 text-purple-700', icon: '🛡' },
  ADMIN_LOC:  { label: 'Admin khu vực',   color: 'bg-red-100 text-red-700',       icon: '👑' },
  ADMIN_OPE:  { label: 'Admin vận hành',  color: 'bg-orange-100 text-orange-700', icon: '🛠' },
  RECEIVING:  { label: 'Nhận hàng',       color: 'bg-sky-100 text-sky-700',       icon: '📦' },
  CHECKIN:    { label: 'Check-in',        color: 'bg-amber-100 text-amber-700',   icon: '🔐' },
};
const UNIT_META_U: Record<string, string> = {
  EMART: 'Emart', THISKYHALL: 'Thiskyhall', TENANT: 'Mall (Khách thuê)',
};
const UNIT_REQUIRED_ROLES = ['RECEIVING', 'CHECKIN'];

function initials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function UserModal({
  user, onClose, onSaved, currentUserId,
}: {
  user?: SystemUser | null;
  onClose: () => void;
  onSaved: () => void;
  currentUserId: string;
}) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    name:       user?.name       ?? '',
    email:      user?.email      ?? '',
    password:   '',
    role:       user?.role       ?? 'ADMIN_OPE',
    unit:       user?.unit       ?? '',
    department: user?.department ?? '',
    businessLocationId: user?.businessLocationId ?? '',
    isActive:   user?.isActive   ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const unitRequired = UNIT_REQUIRED_ROLES.includes(form.role);

  function set(k: string, v: string | boolean) {
    setForm((f) => {
      if (k === 'role' && UNIT_REQUIRED_ROLES.includes(v as string) && !f.unit) {
        return { ...f, role: v as string, unit: 'EMART' };
      }
      return { ...f, [k]: v };
    });
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (unitRequired && !form.unit) {
      setError('Vai trò Nhận hàng và Check-in bắt buộc phải chọn đơn vị.');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        name:       form.name,
        role:       form.role,
        unit:       form.unit  || null,
        department: form.department || null,
        businessLocationId: form.role === 'SUPERADMIN' ? null : (form.businessLocationId || null),
        isActive:   form.isActive,
        ...(isEdit ? {} : { email: form.email, password: form.password }),
      };
      if (isEdit) {
        await api.patch(`/api/users/${user!.id}`, payload);
      } else {
        await api.post('/api/users', payload);
      }
      onSaved();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  const isSelf = user?.id === currentUserId;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between">
          <h3 className="font-bold text-thiso-800">{isEdit ? 'Chỉnh sửa người dùng' : 'Tạo người dùng mới'}</h3>
          <button onClick={onClose} className="text-thiso-400 hover:text-thiso-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Họ tên *</label>
            <input className="input w-full" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="Nguyễn Văn A" />
          </div>

          {/* Email — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Email *</label>
              <input className="input w-full" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required placeholder="user@mall.com" />
            </div>
          )}

          {/* Password — only on create */}
          {!isEdit && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Mật khẩu * (tối thiểu 6 ký tự)</label>
              <input className="input w-full font-mono" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} required minLength={6} placeholder="••••••" />
            </div>
          )}

          {/* Role */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Vai trò *</label>
            <select
              className="input w-full"
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              disabled={isSelf}
            >
              {Object.entries(ROLE_META).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
            {isSelf && <p className="text-[11px] text-thiso-400 mt-1">Không thể thay đổi vai trò của tài khoản đang đăng nhập</p>}
          </div>

          {/* Unit */}
          {form.role !== 'SUPERADMIN' && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Đơn vị{unitRequired ? ' *' : ''}</label>
              <select className="input w-full" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {!unitRequired && <option value="">— Tất cả đơn vị —</option>}
                <option value="EMART">🏬 Emart</option>
                <option value="THISKYHALL">🏢 Thiskyhall</option>
                <option value="TENANT">🏪 Mall (Khách thuê)</option>
              </select>
              {unitRequired && <p className="text-[11px] text-thiso-400 mt-1">RECEIVING và CHECKIN chỉ được thao tác trong một đơn vị cụ thể.</p>}
            </div>
          )}

          {/* Business Location */}
          {form.role !== 'SUPERADMIN' && (
            <div>
              <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">BusinessLocation ID *</label>
              <input
                className="input w-full font-mono"
                value={form.businessLocationId}
                onChange={(e) => set('businessLocationId', e.target.value)}
                required
                placeholder="vd: singleton, loc_phi..."
              />
              <p className="text-[11px] text-thiso-400 mt-1">Tài khoản không phải SUPERADMIN bắt buộc thuộc một khu vực.</p>
            </div>
          )}

          {/* Department */}
          <div>
            <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Bộ phận / Ca làm việc</label>
            <input className="input w-full" value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="vd: Nhận hàng ca sáng, Bảo vệ cổng B..." maxLength={100} />
          </div>

          {/* isActive — only on edit, not self */}
          {isEdit && !isSelf && (
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => set('isActive', !form.isActive)}
                className={`relative w-10 h-6 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-thiso-300'}`}
              >
                <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-sm font-medium text-thiso-700">
                {form.isActive ? 'Tài khoản đang hoạt động' : 'Tài khoản bị vô hiệu'}
              </span>
            </label>
          )}

          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-sm text-red-700">⚠ {error}</div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: SystemUser; onClose: () => void }) {
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState('');

  function genRandom() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    const pw = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setPassword(pw); setConfirm(pw); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Mật khẩu xác nhận không khớp'); return; }
    setSaving(true); setError('');
    try {
      await api.patch(`/api/users/${user.id}/reset-password`, { password });
      setDone(true);
    } catch {
      setError('Có lỗi xảy ra');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-thiso-100 flex items-center justify-between">
          <h3 className="font-bold text-thiso-800">Đặt lại mật khẩu</h3>
          <button onClick={onClose} className="text-thiso-400 hover:text-thiso-600 text-xl leading-none">×</button>
        </div>
        <div className="p-6">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-bold text-green-700">Mật khẩu đã được đặt lại</p>
              <p className="text-sm text-thiso-500 mt-1">Thông báo mật khẩu mới cho người dùng: <strong className="font-mono">{password}</strong></p>
              <button className="mt-5 btn-primary w-full" onClick={onClose}>Đóng</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-thiso-600">Đặt mật khẩu mới cho <strong>{user.name}</strong></p>
              <div>
                <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Mật khẩu mới</label>
                <div className="flex gap-2">
                  <input className="input flex-1 font-mono" type="text" value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} required minLength={6} placeholder="Nhập hoặc tạo ngẫu nhiên" />
                  <button type="button" onClick={genRandom} className="btn-secondary text-xs px-3 whitespace-nowrap">🎲 Ngẫu nhiên</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-thiso-500 uppercase tracking-wide mb-1">Xác nhận mật khẩu</label>
                <input className="input w-full font-mono" type="text" value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} required />
              </div>
              {error && <p className="text-sm text-red-600">⚠ {error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" className="btn-secondary flex-1" onClick={onClose}>Hủy</button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? '...' : 'Đặt lại'}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function UsersTab({ currentUserId }: { currentUserId: string }) {
  const qc = useQueryClient();
  const [modal, setModal]         = useState<'create' | 'edit' | 'reset' | null>(null);
  const [selected, setSelected]   = useState<SystemUser | null>(null);
  const [filterRole, setFilterRole] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
  const [search, setSearch]       = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const { data: users = [], isLoading } = useQuery<SystemUser[]>({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/api/users')).data,
  });

  function refresh() { qc.invalidateQueries({ queryKey: ['users'] }); setModal(null); setSelected(null); }

  async function handleDelete(id: string) {
    try {
      const r = await api.delete(`/api/users/${id}`);
      setDeleteMsg(r.data.deleted ? 'Đã xóa tài khoản' : 'Đã vô hiệu hóa tài khoản (có lịch sử)');
      refresh();
    } catch (err: unknown) {
      setDeleteMsg((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Lỗi');
    } finally {
      setDeleteId(null);
      setTimeout(() => setDeleteMsg(''), 4000);
    }
  }

  const filtered = users.filter((u) => {
    if (!showInactive && !u.isActive) return false;
    if (filterRole && u.role !== filterRole) return false;
    if (filterUnit && u.unit !== filterUnit) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q) && !(u.department ?? '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div>
      {modal === 'create' && (
        <UserModal onClose={() => setModal(null)} onSaved={refresh} currentUserId={currentUserId} />
      )}
      {modal === 'edit' && selected && (
        <UserModal user={selected} onClose={() => { setModal(null); setSelected(null); }} onSaved={refresh} currentUserId={currentUserId} />
      )}
      {modal === 'reset' && selected && (
        <ResetPasswordModal user={selected} onClose={() => { setModal(null); setSelected(null); }} />
      )}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-thiso-800 mb-2">Xóa tài khoản?</h3>
            <p className="text-sm text-thiso-500 mb-5">Nếu tài khoản đã có lịch sử, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn.</p>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDeleteId(null)}>Hủy</button>
              <button className="btn-danger flex-1" onClick={() => handleDelete(deleteId)}>Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-thiso-400 text-sm pointer-events-none">🔍</span>
          <input
            className="w-full pl-9 pr-3 py-2 text-sm border border-thiso-200 rounded-xl bg-white focus:outline-none focus:border-sky-400"
            placeholder="Tìm tên, email, bộ phận..."
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input text-sm py-2 min-w-[140px]" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">Tất cả vai trò</option>
          {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select className="input text-sm py-2 min-w-[140px]" value={filterUnit} onChange={(e) => setFilterUnit(e.target.value)}>
          <option value="">Tất cả đơn vị</option>
          <option value="EMART">🏬 Emart</option>
          <option value="THISKYHALL">🏢 Thiskyhall</option>
          <option value="TENANT">🏪 Mall</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-thiso-500 cursor-pointer select-none">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Hiện TK vô hiệu
        </label>
        <button className="btn-primary ml-auto" onClick={() => setModal('create')}>+ Tạo tài khoản</button>
      </div>

      {deleteMsg && (
        <div className="mb-3 px-4 py-2.5 bg-sky-50 border border-sky-200 rounded-xl text-sm text-sky-700">{deleteMsg}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {Object.entries(ROLE_META).map(([role, meta]) => {
          const cnt = users.filter((u) => u.role === role && u.isActive).length;
          return (
            <div key={role} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cnt > 0 ? 'bg-white border-thiso-100' : 'bg-thiso-50 border-thiso-100 opacity-60'}`}>
              <span className="text-2xl">{meta.icon}</span>
              <div>
                <div className="text-xl font-black text-thiso-800 leading-none">{cnt}</div>
                <div className="text-xs text-thiso-500 mt-0.5">{meta.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-thiso-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-thiso-50 text-xs text-thiso-400 uppercase border-b border-thiso-100 text-left">
                <th className="px-4 py-3">Người dùng</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Vai trò</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Đơn vị</th>
                <th className="px-4 py-3">Bộ phận</th>
                <th className="px-4 py-3 text-center">Trạng thái</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="py-12 text-center text-thiso-400">Đang tải...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-thiso-400">Không có người dùng nào</td></tr>
              )}
              {filtered.map((u) => {
                const rm = ROLE_META[u.role] ?? ROLE_META.CHECKIN;
                const isSelf = u.id === currentUserId;
                return (
                  <tr key={u.id} className={`border-b border-thiso-50 last:border-0 transition-colors ${!u.isActive ? 'opacity-50 bg-thiso-50/50' : 'hover:bg-thiso-50/60'}`}>
                    {/* Avatar + name */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                          style={{ background: u.isActive ? '#1C3A5C' : '#9CA3AF' }}
                        >
                          {initials(u.name)}
                        </div>
                        <div>
                          <div className="font-semibold text-thiso-800 leading-none">
                            {u.name}
                            {isSelf && <span className="ml-1.5 text-[10px] text-sky-500 font-bold">(bạn)</span>}
                          </div>
                          <div className="text-[10px] text-thiso-400 mt-0.5">
                            Tạo {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-thiso-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${rm.color}`}>
                        {rm.icon} {rm.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-thiso-500">
                      {u.businessLocationId ?? <span className="text-thiso-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-thiso-600">
                      {u.unit ? UNIT_META_U[u.unit] : <span className="text-thiso-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-thiso-600">
                      {u.department ?? <span className="text-thiso-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.isActive ? '✓ Hoạt động' : '✗ Vô hiệu'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end flex-wrap">
                        <button
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-thiso-200 text-thiso-600 hover:bg-thiso-50 transition-colors"
                          onClick={() => { setSelected(u); setModal('edit'); }}
                        >✏ Sửa</button>
                        <button
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 transition-colors"
                          onClick={() => { setSelected(u); setModal('reset'); }}
                        >🔑 Mật khẩu</button>
                        {!isSelf && (
                          <button
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                            onClick={() => setDeleteId(u.id)}
                          >{u.isActive ? 'Vô hiệu' : 'Xóa'}</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-thiso-400">* Tài khoản có lịch sử sử dụng sẽ bị vô hiệu hóa thay vì xóa hoàn toàn.</p>
    </div>
  );
}
