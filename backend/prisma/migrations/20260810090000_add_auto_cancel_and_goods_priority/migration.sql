ALTER TABLE "unit_configs"
  ADD COLUMN "auto_cancel_called_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "auto_cancel_called_after_minutes" INTEGER NOT NULL DEFAULT 15;

ALTER TABLE "slots"
  ADD COLUMN "goods_priority" "GoodsType"[] NOT NULL DEFAULT ARRAY[]::"GoodsType"[];
