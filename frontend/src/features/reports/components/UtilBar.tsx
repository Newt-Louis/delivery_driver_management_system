import { Progress } from 'antd';
export default function UtilBar({ pct }: { pct: number }) { return <Progress percent={Math.min(100, pct)} status={pct >= 85 ? 'exception' : 'normal'} format={() => `${pct}%`} size="small" />; }
