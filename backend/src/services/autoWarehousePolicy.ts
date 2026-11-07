import { GoodsType } from '@prisma/client';
import { domainError } from '../modules/shared/domainError';

export function resolveCheckInGoodsType(args: {
  goodsType: GoodsType;
  originalGoodsType: GoodsType | null;
  vendorMatches: boolean;
}): { goodsType: GoodsType; autoWarehouse: boolean } {
  if (args.vendorMatches) return { goodsType: GoodsType.AUTO_WAREHOUSE, autoWarehouse: true };
  const original = args.originalGoodsType ?? args.goodsType;
  if (original === GoodsType.AUTO_WAREHOUSE) {
    throw domainError.conflict('Không thể xác định loại hàng gốc của lượt kho tự động cũ. Vui lòng kiểm tra mã nhà cung cấp hoặc đăng ký lại.', 'OriginalGoodsTypeUnknown');
  }
  return { goodsType: original, autoWarehouse: false };
}
