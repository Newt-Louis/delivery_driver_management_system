import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { allowedBackofficeTabs, BACKOFFICE_TABS } from '../features/backoffice/constants';
import type { BackofficeTab } from '../features/backoffice/types';
import SlotsTab from '../features/backoffice/tabs/SlotsTab';
import ZonesTab from '../features/backoffice/tabs/ZonesTab';
import UnitsTab from '../features/backoffice/tabs/UnitsTab';
import BrandTab from '../features/backoffice/tabs/BrandTab';
import StaffUsersTab from '../features/backoffice/tabs/StaffUsersTab';
import UsersTab from '../features/backoffice/tabs/UsersTab';
import AWVendorTab from '../features/backoffice/tabs/AWVendorTab';

export default function Backoffice() {
  const { user } = useAuth();
  const allowedTabs = useMemo(() => allowedBackofficeTabs(user?.role), [user?.role]);
  const allowedTabKey = allowedTabs.join(',');
  const [activeTab, setActiveTab] = useState<BackofficeTab>(() => allowedBackofficeTabs(user?.role)[0] ?? 'units');

  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [activeTab, allowedTabKey, allowedTabs]);

  function renderActiveTab() {
    if (!allowedTabs.includes(activeTab)) return null;
    switch (activeTab) {
      case 'slots':
        return <SlotsTab />;
      case 'zones':
        return <ZonesTab />;
      case 'units':
        return <UnitsTab />;
      case 'brand':
        return <BrandTab />;
      case 'staff':
        return <StaffUsersTab />;
      case 'users':
        return <UsersTab currentUserId={user?.id ?? ''} />;
      case 'awvendors':
        return <AWVendorTab />;
      default:
        return null;
    }
  }

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Backoffice — Cấu hình Hệ thống</h1>
          <p className="text-sm text-thiso-400 mt-1">Quản lý slot và cấu hình đơn vị nhận hàng theo quyền tài khoản</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-thiso-200 overflow-x-auto">
        {BACKOFFICE_TABS.filter(([tab]) => allowedTabs.includes(tab)).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${activeTab === tab ? 'bg-white border border-b-white border-thiso-200 text-thiso-800 font-semibold -mb-px' : 'text-thiso-400 hover:text-thiso-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {allowedTabs.length === 0 ? (
        <div className="card text-sm text-thiso-500">Tài khoản hiện tại không có quyền vào Backoffice.</div>
      ) : renderActiveTab()}
    </div>
  );
}
