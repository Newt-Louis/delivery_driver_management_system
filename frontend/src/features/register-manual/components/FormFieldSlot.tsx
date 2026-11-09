import { Form } from 'antd';
import type { ReactNode } from 'react';

type FormFieldSlotProps = {
  /** Antd Form.Item tự truyền id/value/onChange; slot chỉ dùng id để cuộn tới khi lỗi. */
  id?: string;
  value?: unknown;
  onChange?: unknown;
  children: ReactNode;
};

/**
 * Bọc nội dung không phải input (nhóm thẻ chọn, giá trị chỉ hiển thị) bên trong `Form.Item name`
 * để dùng chung `rules`, dòng lỗi đỏ và trạng thái highlight của antd.
 */
export default function FormFieldSlot({ id, children }: FormFieldSlotProps) {
  const { status } = Form.Item.useStatus();
  return (
    <div id={id} tabIndex={-1} className={`register-field-slot ${status === 'error' ? 'register-field-slot-error' : ''}`}>
      {children}
    </div>
  );
}
