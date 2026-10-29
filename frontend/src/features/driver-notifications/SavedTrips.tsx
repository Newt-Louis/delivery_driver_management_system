import { useEffect, useState } from 'react';
import { Alert, Button, Card, Space, Spin, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { DELIVERY_SESSIONS_CHANGED, getDeliverySessions, removeDeliverySession } from '../../lib/session';
import { fetchDeliveryByCode } from '../track/api';
import { STATUS_INFO } from '../track/constants';
import type { TrackDelivery } from '../track/types';
import { TERMINAL_STATUSES } from './model';

export default function SavedTrips() {
  const [codes, setCodes] = useState(getDeliverySessions);
  const [trips, setTrips] = useState<TrackDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const sync = () => setCodes((old) => {
      const next = getDeliverySessions();
      return JSON.stringify(old) === JSON.stringify(next) ? old : next;
    });
    window.addEventListener(DELIVERY_SESSIONS_CHANGED, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(DELIVERY_SESSIONS_CHANGED, sync); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    let disposed = false;
    setLoading(codes.length > 0);
    setFailed(false);
    void Promise.allSettled(codes.map(fetchDeliveryByCode)).then((results) => {
      if (disposed) return;
      const active: TrackDelivery[] = [];
      let errors = false;
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          if (TERMINAL_STATUSES.has(result.value.status)) removeDeliverySession(codes[index]);
          else active.push(result.value);
        } else if (result.reason?.response?.status === 404) removeDeliverySession(codes[index]);
        else errors = true;
      });
      setTrips(active);
      setFailed(errors);
      setLoading(false);
    });
    return () => { disposed = true; };
  }, [codes, attempt]);
  if (!codes.length) return null;
  return <Card size="small" title="Chuyến đã lưu trên thiết bị này">
    <Space orientation="vertical" className="w-full" size="middle">
      {loading && <Spin />}
      {failed && <Alert type="warning" title="Chưa tải được một số chuyến" action={<Button onClick={() => setAttempt((v) => v + 1)}>Thử lại</Button>} />}
      {trips.map((trip) => <div key={trip.registrationCode} className="flex flex-wrap items-center justify-between gap-3">
        <Space orientation="vertical" size={0} className="min-w-0">
          <Typography.Text strong>{trip.vehiclePlate} · {trip.unitConfig?.displayName ?? trip.receivingUnit}</Typography.Text>
          <Typography.Text type="secondary">{STATUS_INFO[trip.status]?.label ?? trip.status}</Typography.Text>
          <Typography.Text className="break-all">{trip.registrationCode}</Typography.Text>
        </Space>
        <Link to={`/track/${trip.registrationCode}`}><Button size="large">Tiếp tục theo dõi</Button></Link>
      </div>)}
    </Space>
  </Card>;
}
