-- An old non-exclusive slot configured with only AUTO_WAREHOUSE accepted no goods.
-- The new representation has no equivalent; require an explicit operator correction.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "slots" WHERE NOT "auto_warehouse_only"
    AND cardinality("accepted_goods") > 0
    AND cardinality(array_remove("accepted_goods", 'AUTO_WAREHOUSE'::"GoodsType")) = 0) THEN
    RAISE EXCEPTION 'Correct non-exclusive slots accepting only AUTO_WAREHOUSE before migration';
  END IF;
END $$;

-- Preserve the goods accepted by existing slots before removing the exclusive flag.
UPDATE "slots"
SET "accepted_goods" = ARRAY['AUTO_WAREHOUSE'::"GoodsType"],
    "goods_priority" = ARRAY['AUTO_WAREHOUSE'::"GoodsType"]
WHERE "auto_warehouse_only" = true;

UPDATE "slots"
SET "accepted_goods" = ARRAY['FRESH_FOOD'::"GoodsType", 'GENERAL_GOODS'::"GoodsType", 'THI_CONG'::"GoodsType"]
WHERE "auto_warehouse_only" = false AND cardinality("accepted_goods") = 0;

-- Old non-exclusive slots ignored AUTO_WAREHOUSE even if it appeared in their arrays.
UPDATE "slots"
SET "accepted_goods" = array_remove("accepted_goods", 'AUTO_WAREHOUSE'::"GoodsType"),
    "goods_priority" = array_remove("goods_priority", 'AUTO_WAREHOUSE'::"GoodsType")
WHERE "auto_warehouse_only" = false;

ALTER TABLE "slots" DROP COLUMN "auto_warehouse_only";
ALTER TABLE "unit_goods_types" ALTER COLUMN "emoji" SET DEFAULT '';
UPDATE "unit_goods_types" SET "emoji" = '' WHERE "emoji" IN ('🥬', '📦', '🔨', '🚛', '🛵');
