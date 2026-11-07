import type { GoodsType, Slot } from '../../lib/types';

export const SLOT_GOODS: GoodsType[] = ['FRESH_FOOD', 'GENERAL_GOODS', 'THI_CONG', 'AUTO_WAREHOUSE'];

export function slotGoodsPriority(slot?: Slot | null): GoodsType[] {
  const accepted = slot?.acceptedGoods?.length ? slot.acceptedGoods : SLOT_GOODS;
  const allowed = accepted.filter((goodsType) => SLOT_GOODS.includes(goodsType));
  const priority = (slot?.goodsPriority ?? []).filter((goodsType) => allowed.includes(goodsType));
  return [...new Set([...priority, ...allowed])];
}
