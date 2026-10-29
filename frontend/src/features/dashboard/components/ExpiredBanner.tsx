import { useState } from 'react';
import { Alert, Button } from 'antd';
import { expireStaleDeliveries } from '../api';
export default function ExpiredBanner({ count, onDone }: { count: number; onDone: () => void }) {
 const [loading, setLoading] = useState(false); const [message, setMessage] = useState('');
 async function runExpire() { setLoading(true); try { setMessage(await expireStaleDeliveries()); onDone(); } catch { setMessage('Lỗi khi xử lý'); } finally { setLoading(false); setTimeout(() => setMessage(''), 5000); } }
 return <Alert type="info" showIcon message={`${count} đăng ký quá ngày đã tự động lưu vào lịch sử. Tra cứu tại Báo cáo → Lịch sử, lọc trạng thái Hết hạn.`} action={message || <Button loading={loading} onClick={runExpire}>Xử lý ngay</Button>} />;
}
