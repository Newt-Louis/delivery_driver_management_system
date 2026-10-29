import { Card, Statistic, Typography } from 'antd';
export default function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string; color?: string }) { return <Card size="small"><Statistic title={label} value={value} />{sub && <Typography.Text type="secondary">{sub}</Typography.Text>}</Card>; }
