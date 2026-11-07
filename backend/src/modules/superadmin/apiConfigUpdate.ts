import { domainError } from '../shared/domainError';
import type { SuperadminFormRequest } from './superadminFormRequest';

type Update = ReturnType<typeof SuperadminFormRequest.parseApiConfigUpdate>;

export function prepareApiConfigUpdate(existing: { key: string; value: unknown; isRuntimeEditable: boolean }, body: Update) {
  const newKey = `api.settings.${body.name}`;
  if (existing.key !== newKey && !['po_verify', 'thi_cong_verify'].includes(body.name)) {
    throw domainError.badRequest('Loại API không được hỗ trợ.');
  }
  if (!existing.isRuntimeEditable) throw domainError.badRequest('AppConfig này không cho phép chỉnh runtime.');
  if (existing.value === null || typeof existing.value !== 'object' || Array.isArray(existing.value)) {
    throw domainError.badRequest('Dữ liệu API Config không hợp lệ.');
  }
  const { endpoint, method, payload_keys, auth } = body;
  return {
    key: newKey,
    value: { ...existing.value, ...(endpoint !== undefined ? { endpoint } : {}), ...(method !== undefined ? { method } : {}), ...(payload_keys !== undefined ? { payload_keys } : {}), ...(auth !== undefined ? { auth } : {}) },
  };
}
