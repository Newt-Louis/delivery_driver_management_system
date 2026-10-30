import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Collapse, Empty, Space, Statistic, Tag, theme } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import type { DashboardSummary, DispatchData } from '../../../lib/types';
import { getUnitMeta } from '../utils';

type Severity = 'warning' | 'error';
type OverviewAlert = { key: string; message: string; deliveryId?: string };

export default function AllTabOverview({ dispatch, summary, onAction }: {
  dispatch: DispatchData;
  summary?: DashboardSummary;
  onAction: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState<Severity | null>(null);
  const [connectorLeft, setConnectorLeft] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const warningRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLButtonElement>(null);
  const { token } = theme.useToken();
  const alerts: Record<Severity, OverviewAlert[]> = { warning: [], error: [] };

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const button = expanded === 'warning' ? warningRef.current : expanded === 'error' ? errorRef.current : null;
    if (!grid || !button) return;

    const updateConnector = () => {
      const gridBounds = grid.getBoundingClientRect();
      const buttonBounds = button.getBoundingClientRect();
      // When cards wrap, never draw a connector through another card.
      setConnectorLeft(Math.abs(buttonBounds.bottom - gridBounds.bottom) < 2
        ? buttonBounds.left + buttonBounds.width / 2 - gridBounds.left
        : null);
    };
    updateConnector();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateConnector);
      return () => window.removeEventListener('resize', updateConnector);
    }
    const observer = new ResizeObserver(updateConnector);
    observer.observe(grid);
    observer.observe(button);
    return () => observer.disconnect();
  }, [expanded]);

  if (summary?.noShowRisk) alerts.warning.push({ key: 'summary-no-show', message: `${summary.noShowRisk} xe gọi hơn 15 phút chưa vào vị trí – gọi lại hoặc hủy.` });
  if (summary?.urgentFreshFood) alerts.error.push({ key: 'summary-fresh', message: `${summary.urgentFreshFood} xe hàng tươi sống chờ từ 25 phút – gọi ngay!` });
  for (const [unit, data] of Object.entries(dispatch)) {
    const label = getUnitMeta(unit, data.unitConfig).label;
    data.insights.alerts.forEach((alert, index) => {
      if (alert.level !== 'critical' && alert.level !== 'warning') return;
      const severity = alert.level === 'critical' ? 'error' : 'warning';
      alerts[severity].push({ key: `${unit}-${alert.deliveryId ?? index}-${index}`, message: `${label}: ${alert.message}`, deliveryId: alert.deliveryId });
    });
  }

  const severityColor = expanded === 'error' ? token.colorError : token.colorWarning;
  const alertButton = (severity: Severity, label: string) => {
    const color = severity === 'error' ? token.colorError : token.colorWarning;
    return <Button
      block
      ref={severity === 'warning' ? warningRef : errorRef}
      aria-expanded={expanded === severity}
      aria-controls="dashboard-overview-alerts"
      onClick={() => setExpanded((current) => current === severity ? null : severity)}
      style={{ height: '100%', minHeight: 92, textAlign: 'left', borderColor: color, background: expanded === severity ? (severity === 'error' ? token.colorErrorBg : token.colorWarningBg) : undefined, whiteSpace: 'normal' }}
    >
      <Statistic title={label} value={summary ? alerts[severity].length : '–'} valueStyle={{ color }} suffix={<span style={{ fontSize: token.fontSize }}>{severity === 'error' ? 'trường hợp cần xử lý gấp' : 'trường hợp cảnh báo cần xử lý'}</span>} />
    </Button>;
  };

  return <section className="mb-5" aria-label="Tổng quan điều phối hôm nay">
    <div ref={gridRef}><AdaptiveGrid minColumnWidth={200}>
      <Card size="small"><Statistic title="Tổng lượt xe đã đăng ký" value={summary?.totalRegisteredToday ?? '–'}/></Card>
      <Card size="small"><Statistic title="Tổng lượt xe đã check-in" value={summary?.totalCheckedInToday ?? '–'}/></Card>
      {alertButton('warning', 'Cảnh báo')}
      {alertButton('error', 'Xử lý gấp')}
    </AdaptiveGrid></div>
    <div id="dashboard-overview-alerts">
      <Collapse
        activeKey={expanded ? ['alerts'] : []}
        ghost
        items={[{
          key: 'alerts',
          label: null,
          showArrow: false,
          styles: { header: { display: 'none' }, body: { padding: 0 } },
          children: <div style={{ position: 'relative', paddingTop: 24 }}>
            {expanded && connectorLeft !== null && <div aria-hidden="true" className="hidden lg:block" style={{ position: 'absolute', left: connectorLeft, top: 0, height: 24, borderLeft: `1px solid ${severityColor}` }} />}
            <div style={{ border: `1px solid ${severityColor}`, borderRadius: token.borderRadiusLG, padding: token.padding }}>
            <Space wrap style={{ marginBottom: token.marginSM }}><Tag color={expanded === 'error' ? 'error' : 'warning'}>{expanded === 'error' ? 'Xử lý gấp' : 'Cảnh báo'}</Tag></Space>
            {expanded && alerts[expanded].length ? <Space orientation="vertical" size="small" style={{ width: '100%' }}>
              {alerts[expanded].map((alert) => <Alert key={alert.key} type={expanded} showIcon title={alert.message} action={alert.deliveryId && <Button onClick={() => onAction(alert.deliveryId!)} size="small">Xử lý</Button>} />)}
            </Space> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thông báo cần xử lý" />}
            </div>
          </div>,
        }]}
      />
    </div>
  </section>;
}
