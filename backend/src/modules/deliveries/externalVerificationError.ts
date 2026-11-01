import { domainError } from '../shared/domainError';

export function externalVerificationHttpError(status: number, kind: 'PO' | 'CONSTRUCTION') {
  if (status >= 500) {
    return domainError.badRequest('Có lỗi kết nối với bên kiểm tra, vui lòng thông báo cho bộ phận liên quan', 'ExternalApiServerError');
  }
  if (status === 401 || status === 403) {
    return domainError.badRequest('API kiểm tra từ chối xác thực. Vui lòng kiểm tra Authorization trong cấu hình API.', 'ExternalApiUnauthorized');
  }
  if (status === 404) {
    return domainError.notFound(kind === 'PO' ? 'Mã PO không tồn tại' : 'Mã Thi Công không tồn tại');
  }
  if (status >= 400) {
    return domainError.badRequest('Không thể kiểm tra mã lúc này. Vui lòng thử lại sau.', 'ExternalApiRequestFailed');
  }
  return null;
}
