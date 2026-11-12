import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApartmentOutlined, AppstoreOutlined, InboxOutlined, MobileOutlined, PictureOutlined, SettingOutlined, TeamOutlined } from '@ant-design/icons';
import { Button, Empty, Space, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';
import AdminSectionFrame, { type AdminSectionItem } from '../components/layout/AdminSectionFrame';
import { allowedBackofficeTabs, BACKOFFICE_TABS } from '../features/backoffice/constants';
import type { BackofficeTab } from '../features/backoffice/types';
import SlotsTab from '../features/backoffice/tabs/SlotsTab';
import ZonesTab from '../features/backoffice/tabs/ZonesTab';
import UnitsTab from '../features/backoffice/tabs/UnitsTab';
import BrandTab from '../features/backoffice/tabs/BrandTab';
import StaffUsersTab from '../features/backoffice/tabs/StaffUsersTab';
import AWVendorTab from '../features/backoffice/tabs/AWVendorTab';
import DevicesTab from '../features/backoffice/tabs/DevicesTab';
import SeedingMenuButton from '../features/seeding/components/SeedingMenuButton';

const SECTION_ICONS: Record<BackofficeTab, React.ReactNode> = {
  slots: <AppstoreOutlined />,
  zones: <ApartmentOutlined />,
  units: <SettingOutlined />,
  brand: <PictureOutlined />,
  staff: <TeamOutlined />,
  awvendors: <InboxOutlined />,
  devices: <MobileOutlined />,
};

export default function Backoffice() {
  const { user } = useAuth();
  const allowedTabs = useMemo(() => allowedBackofficeTabs(user?.role), [user?.role]);
  const allowedTabKey = allowedTabs.join(',');
  const [activeTab, setActiveTab] = useState<BackofficeTab>(() => allowedBackofficeTabs(user?.role)[0] ?? 'units');
  const activeTabMeta = BACKOFFICE_TABS.find(([tab]) => tab === activeTab);

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0]);
  }, [activeTab, allowedTabKey, allowedTabs]);

  const sectionItems: AdminSectionItem[] = BACKOFFICE_TABS
    .filter(([tab]) => allowedTabs.includes(tab))
    .map(([tab, label]) => ({ key: tab, label, icon: SECTION_ICONS[tab] }));

  function renderActiveTab() {
    if (!allowedTabs.includes(activeTab)) return null;
    switch (activeTab) {
      case 'slots': return <SlotsTab />;
      case 'zones': return <ZonesTab />;
      case 'units': return <UnitsTab />;
      case 'brand': return <BrandTab />;
      case 'staff': return <StaffUsersTab />;
      case 'awvendors': return <AWVendorTab />;
      case 'devices': return <DevicesTab />;
      default: return null;
    }
  }

  return (
    <AdminSectionFrame title="Backoffice" items={sectionItems} selectedKey={activeTab} onSelect={(key) => setActiveTab(key as BackofficeTab)}>
      <div className="px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Typography.Title level={1} className="!mb-1 !text-2xl">{activeTabMeta?.[1] ?? 'Backoffice'}</Typography.Title>
            <Typography.Text type="secondary">{activeTabMeta?.[2] ?? 'Cấu hình vận hành theo quyền tài khoản.'}</Typography.Text>
          </div>
          <Space wrap>
            {allowedTabs.length > 0 && <SeedingMenuButton role={user?.role} />}
            {user?.role === 'SUPERADMIN' && (
              <Link to="/superadmin"><Button icon={<SettingOutlined />}>Superadmin</Button></Link>
            )}
          </Space>
        </div>

        {allowedTabs.length === 0 ? <Empty description="Tài khoản hiện tại không có quyền vào Backoffice." /> : renderActiveTab()}
      </div>
    </AdminSectionFrame>
  );
}
