import test from 'node:test';
import assert from 'node:assert/strict';
import { GoodsType } from '@prisma/client';
import { resolveCheckInGoodsType } from '../services/autoWarehousePolicy';

test('check-in classifies a matching vendor regardless of original goods', () => {
  assert.deepEqual(resolveCheckInGoodsType({ goodsType: GoodsType.FRESH_FOOD, originalGoodsType: GoodsType.FRESH_FOOD, vendorMatches: true }),
    { goodsType: GoodsType.AUTO_WAREHOUSE, autoWarehouse: true });
});

test('check-in restores the original goods when the vendor is no longer active', () => {
  assert.deepEqual(resolveCheckInGoodsType({ goodsType: GoodsType.AUTO_WAREHOUSE, originalGoodsType: GoodsType.THI_CONG, vendorMatches: false }),
    { goodsType: GoodsType.THI_CONG, autoWarehouse: false });
});

test('legacy auto warehouse without its original goods cannot be silently reclassified', () => {
  assert.throws(() => resolveCheckInGoodsType({ goodsType: GoodsType.AUTO_WAREHOUSE, originalGoodsType: null, vendorMatches: false }),
    { code: 'OriginalGoodsTypeUnknown' });
  assert.deepEqual(resolveCheckInGoodsType({ goodsType: GoodsType.AUTO_WAREHOUSE, originalGoodsType: null, vendorMatches: true }),
    { goodsType: GoodsType.AUTO_WAREHOUSE, autoWarehouse: true });
});

test('ordinary legacy goods remain unchanged without an eligible vendor', () => {
  assert.deepEqual(resolveCheckInGoodsType({ goodsType: GoodsType.GENERAL_GOODS, originalGoodsType: null, vendorMatches: false }),
    { goodsType: GoodsType.GENERAL_GOODS, autoWarehouse: false });
});
