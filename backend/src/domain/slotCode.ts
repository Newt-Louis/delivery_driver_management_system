/**
 * Mã slot (`Slot.code`) do hệ thống tự sinh, người dùng không nhập và giao diện không hiển thị.
 * Định dạng: `<mã zone>-<số thứ tự 2 chữ số>`, ví dụ `KE-1-01`. Số thứ tự = số lớn nhất đang có
 * trong zone + 1 (không lấp số còn trống). Tên slot (`Slot.name`) mới là nhãn hiển thị.
 *
 * Migration `20261117090000_regenerate_slot_codes` dùng cùng định dạng; đổi định dạng phải sửa cả hai.
 */
const SLOT_CODE_SEQUENCE_WIDTH = 2;

export function formatSlotCode(zoneCode: string, sequence: number): string {
  return `${zoneCode}-${String(sequence).padStart(SLOT_CODE_SEQUENCE_WIDTH, '0')}`;
}

/** Số thứ tự kế tiếp trong zone, bỏ qua các mã không đúng định dạng tự sinh. */
export function nextSlotCodeSequence(zoneCode: string, existingCodes: readonly string[]): number {
  const prefix = `${zoneCode}-`;
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const rest = code.slice(prefix.length);
    if (/^\d+$/.test(rest)) max = Math.max(max, Number(rest));
  }
  return max + 1;
}

/** Bỏ khoảng trắng thừa trong tên slot trước khi lưu. */
export function normalizeSlotName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** So sánh tự nhiên theo tên slot: T1, T2, …, T9, T10. */
export function compareSlotNames(a: string, b: string): number {
  return a.localeCompare(b, 'vi', { numeric: true, sensitivity: 'base' });
}

type DisplaySortableSlot = { assignedUnit: string; vehicleType: string; name: string };

/** Thứ tự hiển thị chuẩn: đơn vị, loại xe, rồi tên slot theo thứ tự tự nhiên. */
export function compareSlotsForDisplay(a: DisplaySortableSlot, b: DisplaySortableSlot): number {
  return a.assignedUnit.localeCompare(b.assignedUnit)
    || a.vehicleType.localeCompare(b.vehicleType)
    || compareSlotNames(a.name, b.name);
}
