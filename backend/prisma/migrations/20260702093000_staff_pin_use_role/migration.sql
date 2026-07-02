-- Staff PINs now use the same application Role enum as login users.
-- Legacy StaffRole.SECURITY is mapped to Role.CHECKIN.

ALTER TABLE "staff_pins" ALTER COLUMN "role" TYPE "Role"
USING (
  CASE "role"::text
    WHEN 'SECURITY' THEN 'CHECKIN'
    WHEN 'RECEIVING' THEN 'RECEIVING'
    ELSE 'CHECKIN'
  END
)::"Role";

DROP TYPE "StaffRole";
