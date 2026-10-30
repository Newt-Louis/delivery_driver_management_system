import { Alert, Button, Card, Space } from 'antd';
import type { UnitDispatch } from '../../../lib/types';
export default function AICard({ unitDispatch, onAction }: { unitDispatch: UnitDispatch; onAction: (id: string, slotId?: string) => void }) {
 const { alerts, recommendations } = unitDispatch.insights; if (!alerts.length && !recommendations.length) return null;
 return <Card title="Gợi ý điều phối" size="small" className="mb-4">
            <Space orientation="vertical" style={{ width: '100%' }}>
                {alerts.filter(a => a.level === 'critical' || a.level === 'warning').map((a, i) => <Alert key={i} type={a.level === 'critical' ? 'error' : 'warning'} showIcon title={a.message} action={a.deliveryId && <Button onClick={() => onAction(a.deliveryId!)} size="small">Xử lý</Button>} />)}
                {recommendations.map((r, i) => <Alert key={i} type="info" showIcon title={r.message} action={r.deliveryId && <Button type="primary" onClick={() => onAction(r.deliveryId!, r.slotId)} size="small">Gọi ngay</Button>} />)}
            </Space>
        </Card>;
}
