-- Slot.code giờ do hệ thống tự sinh, người dùng không nhập và giao diện không hiển thị.
-- Định dạng: `<zones.code>-<số thứ tự>`, số thứ tự có ít nhất 2 chữ số (KE-1-01, KE-1-02, ...).
-- Phải khớp với backend/src/domain/slotCode.ts.
--
-- Migration này sinh lại mã cho mọi slot đang có. Trên database mới (bảng slots trống) các
-- câu lệnh không cập nhật dòng nào.

-- 1. Đặt mã tạm duy nhất để việc đổi hàng loạt không vướng unique (zone_id, code).
UPDATE "slots" SET "code" = '__regen__' || "id";

-- 2. Đánh số lại trong từng zone theo thứ tự tự nhiên của tên slot (T1, T2, ..., T10).
WITH ranked AS (
  SELECT
    s."id",
    z."code" AS zone_code,
    ROW_NUMBER() OVER (
      PARTITION BY s."zone_id"
      ORDER BY
        regexp_replace(s."name", '[0-9]+', '', 'g'),
        COALESCE(substring(s."name" FROM '[0-9]+')::numeric, 0),
        s."name",
        s."id"
    ) AS seq
  FROM "slots" s
  JOIN "zones" z ON z."id" = s."zone_id"
)
UPDATE "slots" s
SET "code" = ranked.zone_code || '-' || CASE WHEN ranked.seq < 10 THEN '0' || ranked.seq::text ELSE ranked.seq::text END
FROM ranked
WHERE ranked."id" = s."id";

-- 3. Đồng bộ bản sao mã slot trong lịch sử với mã mới (theo slot id) để IT tra cứu nhất quán.
UPDATE "delivery_history" h
SET "assigned_slot_code" = s."code"
FROM "slots" s
WHERE h."assigned_slot_id" = s."id";

UPDATE "delivery_history_events" e
SET "slot_code" = s."code"
FROM "slots" s
WHERE e."slot_id" = s."id";
