/*
  Warnings:

  - You are about to drop the column `fresh_food_end_time` on the `unit_configs` table. All the data in the column will be lost.
  - You are about to drop the column `fresh_food_start_time` on the `unit_configs` table. All the data in the column will be lost.
  - You are about to drop the column `general_goods_end_time` on the `unit_configs` table. All the data in the column will be lost.
  - You are about to drop the column `general_goods_start_time` on the `unit_configs` table. All the data in the column will be lost.
  - You are about to drop the column `thi_cong_end_time` on the `unit_configs` table. All the data in the column will be lost.
  - You are about to drop the column `thi_cong_start_time` on the `unit_configs` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "unit_configs" DROP COLUMN "fresh_food_end_time",
DROP COLUMN "fresh_food_start_time",
DROP COLUMN "general_goods_end_time",
DROP COLUMN "general_goods_start_time",
DROP COLUMN "thi_cong_end_time",
DROP COLUMN "thi_cong_start_time";
