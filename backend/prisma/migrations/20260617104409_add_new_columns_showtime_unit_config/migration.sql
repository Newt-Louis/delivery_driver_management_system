-- AlterTable
ALTER TABLE "unit_configs" ADD COLUMN     "fresh_food_end_time" TEXT NOT NULL DEFAULT '23:59',
ADD COLUMN     "fresh_food_start_time" TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN     "general_goods_end_time" TEXT NOT NULL DEFAULT '23:59',
ADD COLUMN     "general_goods_start_time" TEXT NOT NULL DEFAULT '00:00',
ADD COLUMN     "thi_cong_end_time" TEXT NOT NULL DEFAULT '23:59',
ADD COLUMN     "thi_cong_start_time" TEXT NOT NULL DEFAULT '00:00';
