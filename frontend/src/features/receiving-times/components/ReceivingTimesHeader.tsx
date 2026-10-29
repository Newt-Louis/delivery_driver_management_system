import { Alert, Button, Space, Typography } from 'antd';
import type { FlashMessage } from '../types';
interface Props { canManageConfig: boolean; pendingCount: number; analyzing: boolean; acceptingAll: boolean; message: FlashMessage; onAnalyze: () => void; onAcceptAll: () => void; onExport: () => void; }
export default function ReceivingTimesHeader({ canManageConfig, pendingCount, analyzing, acceptingAll, message, onAnalyze, onAcceptAll, onExport }: Props) {
 return <div className="mb-6"><Typography.Title level={2}>Thời gian nhận hàng trung bình</Typography.Title><Typography.Paragraph type="secondary">Hệ thống tự học từ lịch sử để ước tính thời gian chờ cho tài xế</Typography.Paragraph><Space wrap>{canManageConfig && <Button type="primary" loading={analyzing} onClick={onAnalyze}>Phân tích lịch sử</Button>}{canManageConfig && pendingCount > 0 && <Button loading={acceptingAll} onClick={onAcceptAll}>Chấp nhận tất cả ({pendingCount})</Button>}<Button onClick={onExport}>Xuất Excel</Button></Space>{message && <Alert className="mt-3" showIcon type={message.ok ? 'success' : 'error'} message={message.text} />}</div>;
}
