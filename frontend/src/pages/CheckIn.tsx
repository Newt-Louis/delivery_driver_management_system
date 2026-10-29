import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Select, Space, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import type { UnitConfig } from '../lib/types';
import CheckInForm from '../features/check-in/components/CheckInForm';
import CheckInResultCard from '../features/check-in/components/CheckInResultCard';
import WaitingListCard from '../features/check-in/components/WaitingListCard';
import { useCheckIn } from '../features/check-in/hooks/useCheckIn';

export default function CheckIn() {
  const { user, hasRole } = useAuth();
  const canFilter = hasRole('SUPERADMIN', 'ADMIN_LOC');
  const [unitId, setUnitId] = useState<string>();
  useEffect(() => { setUnitId(undefined); }, [user?.businessLocationId]);
  const units = useQuery<UnitConfig[]>({ queryKey: ['check-in', 'units', user?.businessLocationId], queryFn: async () => (await api.get('/api/units/configs')).data, enabled: canFilter });
  const { input, mode, result, error, loading, waitingList, registeredList, waiting, registered, changeInput, changeMode, submitCheckIn, exportWaitingList } = useCheckIn();
  const selectedUnit = canFilter ? unitId : undefined;
  const registeredRows = registeredList.filter((delivery) => !selectedUnit || delivery.unitConfigId === selectedUnit);
  const waitingRows = waitingList.filter((delivery) => !selectedUnit || delivery.unitConfigId === selectedUnit);
  return <div className="mx-auto max-w-7xl px-4 py-6">
    <Space orientation="vertical" size="large" className="w-full">
      <div><Typography.Text type="secondary">Bảo vệ / Security</Typography.Text><Typography.Title level={2}>Check-in xe vào cổng</Typography.Title></div>
      <Card>
        <CheckInForm input={input} mode={mode} loading={loading} onInputChange={changeInput} onModeChange={changeMode} onSubmit={submitCheckIn} />
        {error && <Alert className="mt-3" type="error" showIcon title={error} />}
        {result && <CheckInResultCard delivery={result} />}
      </Card>
      {canFilter && <div>
        <Select aria-label="Lọc theo đơn vị" className="w-full max-w-xs" placeholder="Tất cả đơn vị" allowClear value={unitId} onChange={setUnitId} loading={units.isLoading} options={(units.data ?? []).map((unit) => ({ value: unit.id, label: unit.displayName || unit.shortName || unit.unit }))} />
        {units.isError && <Alert className="mt-2" type="error" title="Không tải được đơn vị" action={<a onClick={() => void units.refetch()}>Thử lại</a>} />}
      </div>}
      <WaitingListCard title="Xe đã đăng ký hôm nay" deliveries={registeredRows} loading={registered.isLoading} error={registered.isError} onRetry={() => void registered.refetch()} />
      <WaitingListCard title="Xe đã check-in" deliveries={waitingRows} loading={waiting.isLoading} error={waiting.isError} onRetry={() => void waiting.refetch()} onExport={() => exportWaitingList(waitingRows)} />
    </Space>
  </div>;
}
