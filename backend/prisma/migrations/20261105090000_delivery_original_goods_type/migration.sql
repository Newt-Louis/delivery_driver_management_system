-- Existing non-warehouse deliveries retain their original category. Older
-- warehouse deliveries have no reliable original category and remain NULL.
ALTER TABLE "delivery_registrations" ADD COLUMN "original_goods_type" "GoodsType";
UPDATE "delivery_registrations"
SET "original_goods_type" = "goods_type"
WHERE "goods_type" <> 'AUTO_WAREHOUSE'::"GoodsType";
