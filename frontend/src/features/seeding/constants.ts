import type { SeedingOption } from './types';

/**
 * Options of the SEEDING dropdown. To add a seeding kind: register it in
 * `backend/src/modules/seeding/seedingTypes.ts` + `seedingService.ts`, then add
 * an entry here.
 */
export const SEEDING_OPTIONS: SeedingOption[] = [
  {
    type: 'registered-deliveries',
    label: 'Seed 100 lượt đăng ký giao hàng',
    confirmDescription: (role) => (role === 'SUPERADMIN'
      ? 'Hệ thống sẽ tạo 100 lượt đăng ký giao hàng hôm nay cho MỖI khu vực kinh doanh đang hoạt động, phân bổ đều theo đơn vị, loại hàng, xe tải và xe máy.'
      : 'Hệ thống sẽ tạo 100 lượt đăng ký giao hàng hôm nay cho khu vực của bạn, phân bổ đều theo đơn vị, loại hàng, xe tải và xe máy.'),
  },
];
