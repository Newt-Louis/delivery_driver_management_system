import type { AuthUser } from '../../middleware/auth';
import { domainError } from '../shared/domainError';
import { seedRegisteredDeliveries } from './deliveryRegisteredSeeding';
import { isSeedingEnabled, SEEDING_ENV_FLAG, type SeedingType } from './seedingTypes';

const SEEDING_ROLES = new Set(['SUPERADMIN', 'ADMIN_LOC']);

/**
 * Runs one seeding kind for the caller's scope:
 * - SUPERADMIN: every active BusinessLocation.
 * - ADMIN_LOC: only the assigned BusinessLocation.
 * Disabled unless `ENABLE_SEEDING=true`, so production never exposes it.
 */
export async function runSeeding(type: SeedingType, user: AuthUser | undefined) {
  if (!user) throw domainError.unauthorized();
  if (!isSeedingEnabled()) {
    throw domainError.forbidden(`Tính năng seeding đang tắt trên môi trường này (cần ${SEEDING_ENV_FLAG}=true).`);
  }
  if (!SEEDING_ROLES.has(user.role)) {
    throw domainError.forbidden('Bạn không có quyền thực hiện thao tác này.');
  }
  if (user.role !== 'SUPERADMIN' && !user.businessLocationId) {
    throw domainError.forbidden('Tài khoản chưa được gán khu vực hoạt động.');
  }

  switch (type) {
    case 'registered-deliveries': {
      const result = await seedRegisteredDeliveries(user);
      if (result.locations.length === 0) {
        throw domainError.unprocessable('Không tìm thấy khu vực kinh doanh active nào để seed dữ liệu.', 'NoSeedingTarget');
      }
      return result;
    }
    default: {
      const unsupported: never = type;
      throw domainError.badRequest(`Loại seeding không được hỗ trợ: ${String(unsupported)}`);
    }
  }
}
