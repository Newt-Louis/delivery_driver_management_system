import { useState } from 'react';
import { superadminApi } from '../api';
import type { AppConfigItem } from '../types';

type AuthType = 'none' | 'basic' | 'bearer' | 'api_key';

interface AuthState {
  type: AuthType;
  username: string;
  password: string;
  token: string;
  keyName: string;
  keyValue: string;
}

interface FormState {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  payloadKeys: string[];
  auth: AuthState;
  category: string;
  description: string;
  isSensitive: boolean;
  isRuntimeEditable: boolean;
}

const EMPTY_AUTH: AuthState = { type: 'none', username: '', password: '', token: '', keyName: '', keyValue: '' };

const EMPTY_FORM: FormState = {
  name: '',
  endpoint: '',
  method: 'POST',
  payloadKeys: [],
  auth: EMPTY_AUTH,
  category: 'api',
  description: '',
  isSensitive: false,
  isRuntimeEditable: true,
};

function parseStoredAuth(stored: unknown): AuthState {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return { ...EMPTY_AUTH };
  const s = stored as Record<string, unknown>;
  const type = s.type as AuthType;
  const header = typeof s.header === 'string' ? s.header : '';

  switch (type) {
    case 'basic': {
      const b64 = header.replace('Authorization: Basic ', '');
      try {
        const decoded = atob(b64);
        const idx = decoded.indexOf(':');
        return { ...EMPTY_AUTH, type: 'basic', username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
      } catch {
        return { ...EMPTY_AUTH, type: 'basic' };
      }
    }
    case 'bearer':
      return { ...EMPTY_AUTH, type: 'bearer', token: header.replace('Authorization: Bearer ', '') };
    case 'api_key': {
      const idx = header.indexOf(': ');
      return { ...EMPTY_AUTH, type: 'api_key', keyName: idx >= 0 ? header.slice(0, idx) : '', keyValue: idx >= 0 ? header.slice(idx + 2) : header };
    }
    default:
      return { ...EMPTY_AUTH, type: 'none' };
  }
}

function computeAuthObject(auth: AuthState): object {
  switch (auth.type) {
    case 'basic':
      return { type: 'basic', header: `Authorization: Basic ${btoa(`${auth.username}:${auth.password}`)}` };
    case 'bearer':
      return { type: 'bearer', header: `Authorization: Bearer ${auth.token}` };
    case 'api_key':
      return { type: 'api_key', header: `${auth.keyName}: ${auth.keyValue}` };
    default:
      return { type: 'none' };
  }
}

function authBadge(auth: unknown) {
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) return null;
  const s = auth as Record<string, unknown>;
  switch (s.type) {
    case 'none': return <span className="px-2 py-0.5 text-xs rounded-full bg-thiso-100 text-thiso-600 font-medium">No Auth</span>;
    case 'basic': return <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 font-medium">Basic Auth</span>;
    case 'bearer': return <span className="px-2 py-0.5 text-xs rounded-full bg-sky-100 text-sky-700 font-medium">Bearer Token</span>;
    case 'api_key': return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 font-medium">API Key</span>;
    default: return null;
  }
}

function getNameFromKey(key: string) {
  return key.replace('api.settings.', '');
}

function getStoredValue(item: AppConfigItem) {
  if (!item.value || typeof item.value !== 'object' || Array.isArray(item.value)) return null;
  return item.value as Record<string, unknown>;
}

function itemToForm(item: AppConfigItem): FormState {
  const v = getStoredValue(item);
  return {
    name: getNameFromKey(item.key),
    endpoint: typeof v?.endpoint === 'string' ? v.endpoint : '',
    method: v?.method === 'GET' ? 'GET' : 'POST',
    payloadKeys: Array.isArray(v?.payload_keys) ? (v.payload_keys as unknown[]).filter((k): k is string => typeof k === 'string') : [],
    auth: parseStoredAuth(v?.auth),
    category: item.category || 'api',
    description: item.description || '',
    isSensitive: item.isSensitive,
    isRuntimeEditable: item.isRuntimeEditable,
  };
}

interface ApiConfigModalProps {
  editItem: AppConfigItem | null;
  onClose: () => void;
  onDone: () => void;
}

function ApiConfigModal({ editItem, onClose, onDone }: ApiConfigModalProps) {
  const isEdit = editItem !== null;
  const [form, setForm] = useState<FormState>(isEdit ? itemToForm(editItem!) : EMPTY_FORM);
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setAuth(patch: Partial<AuthState>) {
    setForm((f) => ({ ...f, auth: { ...f.auth, ...patch } }));
  }

  function addKey() {
    const k = keyInput.trim();
    if (!k || form.payloadKeys.includes(k)) { setKeyInput(''); return; }
    setForm((f) => ({ ...f, payloadKeys: [...f.payloadKeys, k] }));
    setKeyInput('');
  }

  function removeKey(k: string) {
    setForm((f) => ({ ...f, payloadKeys: f.payloadKeys.filter((x) => x !== k) }));
  }

  async function save() {
    setError('');
    if (!form.endpoint) { setError('Endpoint không được để trống.'); return; }
    if (form.auth.type === 'basic' && (!form.auth.username || !form.auth.password)) {
      setError('Basic Auth yêu cầu username và password.'); return;
    }
    if (form.auth.type === 'bearer' && !form.auth.token) {
      setError('Bearer Token yêu cầu token.'); return;
    }
    if (form.auth.type === 'api_key' && (!form.auth.keyName || !form.auth.keyValue)) {
      setError('API Key yêu cầu header name và value.'); return;
    }

    const apiValue = {
      endpoint: form.endpoint,
      method: form.method,
      payload_keys: form.payloadKeys,
      auth: computeAuthObject(form.auth),
    };

    try {
      setLoading(true);
      if (isEdit) {
        await superadminApi.updateAppConfig(editItem!.key, {
          value: apiValue,
          category: form.category,
          description: form.description,
          isSensitive: form.isSensitive,
          isRuntimeEditable: form.isRuntimeEditable,
        });
      } else {
        await superadminApi.createApiConfig({
          name: form.name,
          endpoint: form.endpoint,
          method: form.method,
          payload_keys: form.payloadKeys,
          auth: computeAuthObject(form.auth),
          category: form.category,
          description: form.description,
          isSensitive: form.isSensitive,
          isRuntimeEditable: form.isRuntimeEditable,
        });
      }
      onDone();
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? ((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Lỗi không xác định.')
        : 'Lỗi không xác định.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const AUTH_TYPES: { key: AuthType; label: string }[] = [
    { key: 'none', label: 'No Auth' },
    { key: 'basic', label: 'Basic Auth' },
    { key: 'bearer', label: 'Bearer Token' },
    { key: 'api_key', label: 'API Key' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-thiso-800 to-thiso-600 p-5 rounded-t-2xl">
          <div className="text-white font-black text-lg">{isEdit ? 'Chỉnh sửa API Config' : 'Thêm API Config mới'}</div>
          <div className="text-white/60 text-xs mt-0.5 font-mono">{isEdit ? editItem!.key : 'api.settings.<tên>'}</div>
        </div>

        <div className="p-5 space-y-4">
          {/* Name (create only) */}
          {!isEdit && (
            <div>
              <label className="label">Tên API (slug) <span className="text-red-500">*</span></label>
              <div className="flex items-center gap-0">
                <span className="input rounded-r-none bg-thiso-50 text-thiso-400 text-sm px-3 py-2 border border-r-0 border-thiso-200 select-none whitespace-nowrap">api.settings.</span>
                <input
                  className="input rounded-l-none"
                  placeholder="po_sala_verify"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                />
              </div>
              <p className="text-xs text-thiso-400 mt-1">Chỉ chữ thường, số, _ và -</p>
            </div>
          )}

          {/* Endpoint + Method */}
          <div>
            <label className="label">Endpoint <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <select
                className="input w-28 shrink-0"
                value={form.method}
                onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as 'GET' | 'POST' }))}
              >
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
              <input
                className="input flex-1"
                placeholder="https://api.example.com/verify"
                value={form.endpoint}
                onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              />
            </div>
          </div>

          {/* Payload keys */}
          <div>
            <label className="label">Payload keys</label>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Thêm key rồi nhấn Enter (vd: code)"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKey(); } }}
              />
              <button type="button" className="btn btn-secondary px-4" onClick={addKey}>+</button>
            </div>
            {form.payloadKeys.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.payloadKeys.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 bg-thiso-100 text-thiso-700 text-xs font-mono px-2 py-1 rounded-lg">
                    {k}
                    <button type="button" className="text-thiso-400 hover:text-red-500 leading-none" onClick={() => removeKey(k)}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Auth */}
          <div>
            <label className="label">Xác thực (Authorization)</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {AUTH_TYPES.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAuth({ type: key })}
                  className={`py-2 px-3 text-sm font-medium rounded-xl border-2 transition-colors text-left ${
                    form.auth.type === key
                      ? 'border-thiso-500 bg-thiso-50 text-thiso-800'
                      : 'border-thiso-200 text-thiso-500 hover:border-thiso-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.auth.type === 'basic' && (
              <div className="space-y-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs font-medium text-amber-700 mb-1">→ Sẽ lưu: <span className="font-mono">Authorization: Basic &lt;base64(user:pass)&gt;</span></p>
                <input className="input" placeholder="Username" value={form.auth.username} onChange={(e) => setAuth({ username: e.target.value })} />
                <input className="input" type="password" placeholder="Password" value={form.auth.password} onChange={(e) => setAuth({ password: e.target.value })} />
              </div>
            )}

            {form.auth.type === 'bearer' && (
              <div className="space-y-2 bg-sky-50 border border-sky-200 rounded-xl p-3">
                <p className="text-xs font-medium text-sky-700 mb-1">→ Sẽ lưu: <span className="font-mono">Authorization: Bearer &lt;token&gt;</span></p>
                <input className="input" placeholder="Token" value={form.auth.token} onChange={(e) => setAuth({ token: e.target.value })} />
              </div>
            )}

            {form.auth.type === 'api_key' && (
              <div className="space-y-2 bg-purple-50 border border-purple-200 rounded-xl p-3">
                <p className="text-xs font-medium text-purple-700 mb-1">→ Sẽ lưu: <span className="font-mono">&lt;header-name&gt;: &lt;value&gt;</span></p>
                <input className="input" placeholder="Header name (vd: X-API-Key)" value={form.auth.keyName} onChange={(e) => setAuth({ keyName: e.target.value })} />
                <input className="input" placeholder="Value" value={form.auth.keyValue} onChange={(e) => setAuth({ keyValue: e.target.value })} />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="border-t border-thiso-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-thiso-500 uppercase">Thông tin dòng DB</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
              <div>
                <label className="label">Description</label>
                <input className="input" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-thiso-700">
                <input type="checkbox" className="w-4 h-4" checked={form.isSensitive} onChange={(e) => setForm((f) => ({ ...f, isSensitive: e.target.checked }))} />
                isSensitive
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-thiso-700">
                <input type="checkbox" className="w-4 h-4" checked={form.isRuntimeEditable} onChange={(e) => setForm((f) => ({ ...f, isRuntimeEditable: e.target.checked }))} />
                isRuntimeEditable
              </label>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}

          <div className="flex gap-3 pt-1">
            <button type="button" className="btn btn-secondary flex-1" onClick={onClose} disabled={loading}>Hủy</button>
            <button type="button" className="flex-1 btn bg-thiso-700 text-white hover:bg-thiso-800 disabled:opacity-50" onClick={save} disabled={loading}>
              {loading ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Tạo API Config'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface ApiConfigCardProps {
  item: AppConfigItem;
  onEdit: () => void;
  onDelete: () => void;
}

function ApiConfigCard({ item, onEdit, onDelete }: ApiConfigCardProps) {
  const v = getStoredValue(item);
  const name = getNameFromKey(item.key);
  const endpoint = typeof v?.endpoint === 'string' ? v.endpoint : '—';
  const method = v?.method === 'GET' ? 'GET' : 'POST';
  const payloadKeys = Array.isArray(v?.payload_keys) ? (v.payload_keys as unknown[]).filter((k): k is string => typeof k === 'string') : [];

  return (
    <div className="border border-thiso-200 rounded-xl p-4 hover:border-thiso-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-black text-thiso-800 text-sm font-mono">{name}</span>
            <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-sky-100 text-sky-700'}`}>{method}</span>
            {authBadge(v?.auth)}
            {item.isSensitive && <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">Sensitive</span>}
            {!item.isRuntimeEditable && <span className="px-2 py-0.5 text-xs rounded-full bg-thiso-100 text-thiso-500">Locked</span>}
          </div>
          <div className="text-xs font-mono text-thiso-400 truncate">{endpoint}</div>
          {item.description && <div className="text-xs text-thiso-500 mt-0.5">{item.description}</div>}
          {payloadKeys.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {payloadKeys.map((k) => (
                <span key={k} className="text-xs font-mono bg-thiso-100 text-thiso-600 px-1.5 py-0.5 rounded">{k}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn btn-secondary text-xs px-3 py-1.5" onClick={onEdit}>Sửa</button>
          <button type="button" className="btn text-xs px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl font-medium" onClick={onDelete}>Xóa</button>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-thiso-300 font-mono">{item.key} · category: {item.category}</div>
    </div>
  );
}

export default function ApiConfigsTab({ apiConfigs, onRefresh }: { apiConfigs: AppConfigItem[]; onRefresh: () => void }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<AppConfigItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppConfigItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  function openCreate() { setEditItem(null); setModalOpen(true); }
  function openEdit(item: AppConfigItem) { setEditItem(item); setModalOpen(true); }
  function closeModal() { setModalOpen(false); setEditItem(null); }
  function handleDone() { closeModal(); onRefresh(); }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await superadminApi.deleteApiConfig(getNameFromKey(deleteTarget.key));
      setDeleteTarget(null);
      onRefresh();
    } catch {
      // keep modal open on error
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-thiso-500">Cấu hình các API tích hợp bên thứ 3 để xác thực mã tài xế (PO, Thi Công, ...).</p>
          <p className="text-xs text-thiso-400 mt-0.5">Mỗi dòng lưu trong <span className="font-mono">app_configs</span> với key <span className="font-mono">api.settings.&lt;tên&gt;</span>.</p>
        </div>
        <button type="button" className="btn btn-primary text-sm px-4 py-2" onClick={openCreate}>+ Thêm API</button>
      </div>

      {apiConfigs.length === 0 ? (
        <div className="text-center py-12 text-thiso-400">
          <div className="text-3xl mb-2">🔗</div>
          <div className="font-medium">Chưa có API nào được cấu hình</div>
          <div className="text-sm mt-1">Nhấn "+ Thêm API" để bắt đầu</div>
        </div>
      ) : (
        <div className="space-y-3">
          {apiConfigs.map((item) => (
            <ApiConfigCard key={item.key} item={item} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)} />
          ))}
        </div>
      )}

      {modalOpen && (
        <ApiConfigModal editItem={editItem} onClose={closeModal} onDone={handleDone} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="text-lg font-black text-thiso-800 mb-2">Xóa API Config?</div>
            <p className="text-sm text-thiso-500 mb-1">Bạn sắp xóa:</p>
            <div className="font-mono text-sm bg-thiso-50 rounded-xl px-3 py-2 mb-4 text-thiso-700">{deleteTarget.key}</div>
            <div className="flex gap-3">
              <button type="button" className="btn btn-secondary flex-1" onClick={() => setDeleteTarget(null)} disabled={deleteLoading}>Hủy</button>
              <button type="button" className="flex-1 btn bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 rounded-xl font-bold py-2.5" onClick={confirmDelete} disabled={deleteLoading}>
                {deleteLoading ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
