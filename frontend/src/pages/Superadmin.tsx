import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiOutlined, AppstoreOutlined, ClockCircleOutlined, ClusterOutlined, CodeOutlined, DatabaseOutlined, EnvironmentOutlined, SettingOutlined, TeamOutlined, TruckOutlined } from '@ant-design/icons';
import { Alert, Button, Spin, Typography } from 'antd';
import AdminSectionFrame, { type AdminSectionItem } from '../components/layout/AdminSectionFrame';
import { superadminApi } from '../features/superadmin/api';
import type { SuperadminTab } from '../features/superadmin/types';
import AppConfigsTab from '../features/superadmin/tabs/AppConfigsTab';
import ApiConfigsTab from '../features/superadmin/tabs/ApiConfigsTab';
import AwVendorsTab from '../features/superadmin/tabs/AwVendorsTab';
import DevicesTab from '../features/superadmin/tabs/DevicesTab';
import GoodsTypesTab from '../features/superadmin/tabs/GoodsTypesTab';
import LocationsTab from '../features/superadmin/tabs/LocationsTab';
import ReceivingTimesTab from '../features/superadmin/tabs/ReceivingTimesTab';
import TimeWindowsTab from '../features/superadmin/tabs/TimeWindowsTab';
import UnitConfigsTab from '../features/superadmin/tabs/UnitConfigsTab';
import UsersTab from '../features/superadmin/tabs/UsersTab';

const TABS: Array<[SuperadminTab, string]> = [
  ['locations', 'Locations'],
  ['units', 'Unit configs'],
  ['users', 'Users'],
  ['goods', 'Goods types'],
  ['windows', 'Time windows'],
  ['awvendors', 'AW vendors'],
  ['devices', 'Devices'],
  ['appconfigs', 'App configs'],
  ['apiconfigs', 'API tích hợp'],
  ['receivingTimes', 'Receiving times'],
];

const SECTION_ICONS: Record<SuperadminTab, React.ReactNode> = {
  locations: <EnvironmentOutlined />,
  units: <AppstoreOutlined />,
  zones: <ClusterOutlined />,
  slots: <DatabaseOutlined />,
  users: <TeamOutlined />,
  goods: <AppstoreOutlined />,
  windows: <ClockCircleOutlined />,
  awvendors: <TruckOutlined />,
  devices: <ApiOutlined />,
  appconfigs: <SettingOutlined />,
  apiconfigs: <CodeOutlined />,
  receivingTimes: <ClockCircleOutlined />,
};

export default function Superadmin() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<SuperadminTab>('locations');
  const [businessLocationId, setBusinessLocationId] = useState('');
  const [unitConfigId, setUnitConfigId] = useState('');

  const needsLocations = ['locations', 'units', 'users', 'goods', 'windows', 'awvendors', 'devices', 'receivingTimes'].includes(activeTab);
  const needsUnitOptions = ['units', 'goods', 'windows', 'awvendors', 'receivingTimes'].includes(activeTab);

  const locations = useQuery({
    queryKey: ['superadmin', 'locations'],
    queryFn: superadminApi.locations,
    enabled: needsLocations,
  });
  const units = useQuery({
    queryKey: ['superadmin', 'units', businessLocationId],
    queryFn: () => superadminApi.units({ businessLocationId: businessLocationId || undefined }),
    placeholderData: (previous) => previous,
    enabled: needsUnitOptions,
  });
  const userUnits = useQuery({
    queryKey: ['superadmin', 'units', 'users-all'],
    queryFn: () => superadminApi.units(),
    enabled: activeTab === 'users',
  });
  const users = useQuery({ queryKey: ['superadmin', 'users'], queryFn: superadminApi.users, enabled: activeTab === 'users' });
  const goodsTypes = useQuery({
    queryKey: ['superadmin', 'goods', businessLocationId, unitConfigId],
    queryFn: () => superadminApi.goodsTypes({ businessLocationId: businessLocationId || undefined, unitConfigId: unitConfigId || undefined }),
    placeholderData: (previous) => previous,
    enabled: activeTab === 'goods',
  });
  const timeWindows = useQuery({
    queryKey: ['superadmin', 'windows', businessLocationId, unitConfigId],
    queryFn: () => superadminApi.timeWindows({ businessLocationId: businessLocationId || undefined, unitConfigId: unitConfigId || undefined }),
    placeholderData: (previous) => previous,
    enabled: activeTab === 'windows',
  });
  const vendors = useQuery({
    queryKey: ['superadmin', 'vendors', businessLocationId, unitConfigId],
    queryFn: () => superadminApi.autoWarehouseVendors({ businessLocationId: businessLocationId || undefined, unitConfigId: unitConfigId || undefined }),
    placeholderData: (previous) => previous,
    enabled: activeTab === 'awvendors',
  });
  const devices = useQuery({
    queryKey: ['superadmin', 'devices', businessLocationId],
    queryFn: () => superadminApi.devices({ businessLocationId: businessLocationId || undefined }),
    placeholderData: (previous) => previous,
    enabled: activeTab === 'devices',
  });
  const appConfigs = useQuery({ queryKey: ['superadmin', 'appconfigs'], queryFn: superadminApi.appConfigs, enabled: activeTab === 'appconfigs' || activeTab === 'apiconfigs' });
  const receivingTimes = useQuery({
    queryKey: ['superadmin', 'receiving-times', businessLocationId, unitConfigId],
    queryFn: () => superadminApi.receivingTimeConfigs({ businessLocationId: businessLocationId || undefined, unitConfigId: unitConfigId || undefined }),
    placeholderData: (previous) => previous,
    enabled: activeTab === 'receivingTimes',
  });

  const tabQueries = {
    locations: [locations], units: [locations, units], users: [locations, userUnits, users],
    goods: [locations, units, goodsTypes], windows: [locations, units, timeWindows],
    awvendors: [locations, units, vendors], devices: [locations, devices],
    appconfigs: [appConfigs], apiconfigs: [appConfigs], receivingTimes: [locations, units, receivingTimes],
    zones: [], slots: [],
  };
  const currentQueries = tabQueries[activeTab].filter(query => query.fetchStatus !== 'idle' || query.data !== undefined || query.isError);
  const loadingTab = currentQueries.some(query => query.isLoading);
  const failedQueries = currentQueries.filter(query => query.isError);

  const allLocations = locations.data ?? [];
  const allUnits = units.data ?? [];
  const selectedLocationUnits = useMemo(
    () => allUnits.filter((unit) => !businessLocationId || unit.businessLocationId === businessLocationId),
    [allUnits, businessLocationId],
  );
  const sectionItems: AdminSectionItem[] = TABS.map(([key, label]) => ({ key, label, icon: SECTION_ICONS[key] }));

  function refreshActiveTab() {
    switch (activeTab) {
      case 'locations':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'locations'] });
        break;
      case 'units':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'units'] });
        break;
      case 'users':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'users'] });
        break;
      case 'goods':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'goods'] });
        break;
      case 'windows':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'windows'] });
        break;
      case 'awvendors':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'vendors'] });
        break;
      case 'devices':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'devices'] });
        break;
      case 'appconfigs':
      case 'apiconfigs':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'appconfigs'] });
        break;
      case 'receivingTimes':
        queryClient.invalidateQueries({ queryKey: ['superadmin', 'receiving-times'] });
        break;
    }
  }

  function changeBusinessLocation(id: string) {
    setBusinessLocationId(id);
    setUnitConfigId('');
  }

  function renderTab() {
    switch (activeTab) {
      case 'locations':
        return <LocationsTab locations={allLocations} onRefresh={refreshActiveTab} />;
      case 'units':
        return (
          <UnitConfigsTab
            locations={allLocations}
            units={allUnits}
            businessLocationId={businessLocationId}
            onBusinessLocationChange={changeBusinessLocation}
            onRefresh={refreshActiveTab}
          />
        );
      case 'users':
        return <UsersTab users={users.data ?? []} locations={allLocations} units={userUnits.data ?? []} onRefresh={refreshActiveTab} />;
      case 'goods':
        return <GoodsTypesTab goodsTypes={goodsTypes.data ?? []} scope={{ locations: allLocations, units: selectedLocationUnits, businessLocationId, unitConfigId, onBusinessLocationChange: changeBusinessLocation, onUnitConfigChange: setUnitConfigId }} />;
      case 'windows':
        return <TimeWindowsTab timeWindows={timeWindows.data ?? []} scope={{ locations: allLocations, units: selectedLocationUnits, businessLocationId, unitConfigId, onBusinessLocationChange: changeBusinessLocation, onUnitConfigChange: setUnitConfigId }} />;
      case 'awvendors':
        return <AwVendorsTab vendors={vendors.data ?? []} units={allUnits} onRefresh={refreshActiveTab} scope={{ locations: allLocations, units: selectedLocationUnits, businessLocationId, unitConfigId, onBusinessLocationChange: changeBusinessLocation, onUnitConfigChange: setUnitConfigId }} />;
      case 'devices':
        return <DevicesTab devices={devices.data ?? []} locations={allLocations} onRefresh={refreshActiveTab} scope={{ locations: allLocations, businessLocationId, unitConfigId, onBusinessLocationChange: changeBusinessLocation, onUnitConfigChange: setUnitConfigId }} />;
      case 'appconfigs':
        return <AppConfigsTab appConfigs={(appConfigs.data ?? []).filter((c) => !c.key.startsWith('api.settings.'))} onRefresh={refreshActiveTab} />;
      case 'apiconfigs':
        return <ApiConfigsTab apiConfigs={(appConfigs.data ?? []).filter((c) => c.key.startsWith('api.settings.'))} onRefresh={refreshActiveTab} />;
      case 'receivingTimes':
        return <ReceivingTimesTab receivingTimes={receivingTimes.data ?? []} units={allUnits} onRefresh={refreshActiveTab} scope={{ locations: allLocations, units: selectedLocationUnits, businessLocationId, unitConfigId, onBusinessLocationChange: changeBusinessLocation, onUnitConfigChange: setUnitConfigId }} />;
      default:
        return null;
    }
  }

  return (
    <AdminSectionFrame title="Superadmin" items={sectionItems} selectedKey={activeTab} onSelect={(key) => setActiveTab(key as SuperadminTab)}>
    <div className="px-4 py-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <Typography.Title level={1} className="!mb-1 !text-2xl">Superadmin</Typography.Title>
          <Typography.Text type="secondary">Master data toàn hệ thống, chỉ dành cho tài khoản SUPERADMIN duy nhất.</Typography.Text>
        </div>

      </div>

      {loadingTab && <Spin tip="Đang tải dữ liệu"><div style={{ minHeight: 100 }} /></Spin>}
      {failedQueries.length > 0 && <Alert type="error" showIcon message="Không thể tải dữ liệu" action={<Button onClick={() => failedQueries.forEach(query => query.refetch())}>Thử lại</Button>} />}
      {!loadingTab && failedQueries.length === 0 && <Spin spinning={(activeTab === 'units' && units.isPlaceholderData && units.isFetching) || (activeTab === 'goods' && ((goodsTypes.isPlaceholderData && goodsTypes.isFetching) || (units.isPlaceholderData && units.isFetching))) || (activeTab === 'windows' && ((timeWindows.isPlaceholderData && timeWindows.isFetching) || (units.isPlaceholderData && units.isFetching))) || (activeTab === 'awvendors' && ((vendors.isPlaceholderData && vendors.isFetching) || (units.isPlaceholderData && units.isFetching))) || (activeTab === 'devices' && devices.isPlaceholderData && devices.isFetching) || (activeTab === 'receivingTimes' && ((receivingTimes.isPlaceholderData && receivingTimes.isFetching) || (units.isPlaceholderData && units.isFetching)))} tip="Đang tải đơn vị">{renderTab()}</Spin>}
    </div>
    </AdminSectionFrame>
  );
}
