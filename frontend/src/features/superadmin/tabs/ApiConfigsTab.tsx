import { useState } from 'react';
import { Alert, Button, Checkbox, Input, Modal, Radio, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { superadminApi } from '../api';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import ReadOnlyMasterList from '../components/ReadOnlyMasterList';
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

function authBadge(auth: unknown) { if (!auth || typeof auth !== 'object' || Array.isArray(auth)) return null; const labels: Record<string, string> = { none: 'No Auth', basic: 'Basic Auth', bearer: 'Bearer Token', api_key: 'API Key' }; const key = String((auth as Record<string, unknown>).type); return labels[key] ? <Tag>{labels[key]}</Tag> : null; }

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

  return <Modal open title={isEdit ? 'Chỉnh sửa API Config' : 'Thêm API Config mới'} onCancel={onClose} onOk={save} okText={isEdit ? 'Lưu thay đổi' : 'Tạo API Config'} cancelText="Hủy" confirmLoading={loading} maskClosable={!loading} closable={!loading} keyboard={!loading} cancelButtonProps={{ disabled: loading }}><Space direction="vertical" style={{ width: '100%' }}>{!isEdit && <label>Tên API (slug)<Input addonBefore="api.settings." placeholder="po_sala_verify" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))} /></label>}<label>Endpoint<Space.Compact style={{ width: '100%' }}><Select aria-label="Phương thức" value={form.method} onChange={v => setForm(f => ({ ...f, method: v }))} options={[{ value: 'POST', label: 'POST' }, { value: 'GET', label: 'GET' }]} /><Input aria-label="Endpoint" placeholder="https://api.example.com/verify" value={form.endpoint} onChange={e => setForm(f => ({ ...f, endpoint: e.target.value }))} /></Space.Compact></label><label>Payload keys<Space.Compact style={{ width: '100%' }}><Input aria-label="Payload key" value={keyInput} onChange={e => setKeyInput(e.target.value)} onPressEnter={addKey} /><Button onClick={addKey}>Thêm</Button></Space.Compact></label><Space wrap>{form.payloadKeys.map(k => <Tag key={k} closable onClose={() => removeKey(k)}>{k}</Tag>)}</Space><Typography.Text>Xác thực (Authorization)</Typography.Text><Radio.Group value={form.auth.type} onChange={e => setAuth({ type: e.target.value })} options={AUTH_TYPES.map(t => ({ value: t.key, label: t.label }))} /><div className="space-y-2">{form.auth.type === 'basic' && <><Input aria-label="Username" placeholder="Username" value={form.auth.username} onChange={e => setAuth({ username: e.target.value })} /><Input.Password aria-label="Password" placeholder="Password" value={form.auth.password} onChange={e => setAuth({ password: e.target.value })} /></>}{form.auth.type === 'bearer' && <Input.Password aria-label="Token" placeholder="Token" value={form.auth.token} onChange={e => setAuth({ token: e.target.value })} />}{form.auth.type === 'api_key' && <><Input aria-label="Header name" placeholder="Header name (vd: X-API-Key)" value={form.auth.keyName} onChange={e => setAuth({ keyName: e.target.value })} /><Input.Password aria-label="Value" placeholder="Value" value={form.auth.keyValue} onChange={e => setAuth({ keyValue: e.target.value })} /></>}</div><div className="grid sm:grid-cols-2 gap-3"><label>Category<Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} /></label><label>Description<Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label></div><Space wrap><Checkbox checked={form.isSensitive} onChange={e => setForm(f => ({ ...f, isSensitive: e.target.checked }))}>isSensitive</Checkbox><Checkbox checked={form.isRuntimeEditable} onChange={e => setForm(f => ({ ...f, isRuntimeEditable: e.target.checked }))}>isRuntimeEditable</Checkbox></Space>{error && <Alert type="error" message={error} />}</Space></Modal>;

}

const apiConfigName = (item: AppConfigItem) => getNameFromKey(item.key);

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
      message.error('Không thể xóa API Config.');
    } finally {
      setDeleteLoading(false);
    }
  }

  const fields = [
    { key: 'name', title: 'Tên API', value: (item: AppConfigItem) => getNameFromKey(item.key) },
    { key: 'method', title: 'Phương thức', value: (item: AppConfigItem) => <Tag>{getStoredValue(item)?.method === 'GET' ? 'GET' : 'POST'}</Tag> },
    { key: 'endpoint', title: 'Endpoint', value: (item: AppConfigItem) => { const v = getStoredValue(item)?.endpoint; return <Typography.Text style={{ overflowWrap: 'anywhere' }}>{typeof v === 'string' ? v : '—'}</Typography.Text>; } },
    { key: 'auth', title: 'Xác thực', value: (item: AppConfigItem) => authBadge(getStoredValue(item)?.auth) ?? '—' },
    { key: 'payload', title: 'Payload keys', value: (item: AppConfigItem) => { const keys = getStoredValue(item)?.payload_keys; return Array.isArray(keys) ? <Space wrap>{keys.filter((k): k is string => typeof k === 'string').map(k => <Tag key={k}>{k}</Tag>)}</Space> : '—'; } },
    { key: 'description', title: 'Description', value: (item: AppConfigItem) => item.description || '—' },
    { key: 'category', title: 'Category', value: (item: AppConfigItem) => item.category },
    { key: 'flags', title: 'Trạng thái', value: (item: AppConfigItem) => <Space wrap>{item.isSensitive && <Tag color="warning">Sensitive</Tag>}{!item.isRuntimeEditable && <Tag>Locked</Tag>}</Space> },
    { key: 'key', title: 'Key', value: (item: AppConfigItem) => item.key },
  ];
  function actions(item: AppConfigItem) { return <Space size="small"><Tooltip title="Chỉnh sửa API"><Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Sửa API ${getNameFromKey(item.key)}`} onClick={() => openEdit(item)} /></Tooltip><Tooltip title="Xóa API"><Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa API ${getNameFromKey(item.key)}`} onClick={() => setDeleteTarget(item)} /></Tooltip></Space>; }
  return <Space orientation="vertical" size="large" className="w-full"><Typography.Paragraph>Cấu hình các API tích hợp bên thứ 3 để xác thực mã tài xế (PO, Thi Công, ...). Mỗi dòng lưu trong app_configs với key api.settings.&lt;tên&gt;.</Typography.Paragraph><ReadOnlyMasterList items={apiConfigs} fields={fields} getName={apiConfigName} searchLabel="Tìm tên API" emptyLabel="Chưa có API phù hợp" createAction={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Thêm API</Button>} actions={actions} />{modalOpen && <ApiConfigModal editItem={editItem} onClose={closeModal} onDone={handleDone} />}<Modal open={!!deleteTarget} title="Xóa API Config?" onCancel={() => setDeleteTarget(null)} onOk={confirmDelete} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }} cancelButtonProps={{ disabled: deleteLoading }} confirmLoading={deleteLoading} maskClosable={!deleteLoading} closable={!deleteLoading} keyboard={!deleteLoading}>{deleteTarget?.key}</Modal></Space>;
}
