import { useState } from 'react';
import { Input, Modal } from 'antd';
interface Props { onClose: () => void; onSubmit: (reason: string) => void; loading: boolean; }
export default function CancelReasonModal({ onClose, onSubmit, loading }: Props) {
 const [reason, setReason] = useState(''); const trimmed = reason.trim();
 return <Modal open title="Lý do hủy lượt giao hàng" onCancel={onClose} closable={!loading} maskClosable={!loading} keyboard={!loading} okText="Xác nhận hủy" cancelText="Đóng" okButtonProps={{ danger: true, disabled: trimmed.length < 3, loading }} cancelButtonProps={{ disabled: loading }} onOk={() => onSubmit(trimmed)}><label htmlFor="cancel-reason">Lý do hủy</label><Input.TextArea id="cancel-reason" rows={5} value={reason} onChange={e => setReason(e.target.value)} disabled={loading} autoFocus /></Modal>;
}
