import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  BarChartOutlined,
  BulbOutlined,
  DownOutlined,
  FileTextOutlined,
  HistoryOutlined,
  HomeOutlined,
  LoginOutlined,
  MenuOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, ConfigProvider, Drawer, Dropdown, Grid, Layout, Menu, Space, Tooltip, Typography, theme, type MenuProps } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { useThemeMode } from '../../context/ThemeModeContext';

type NavigationItem = { to: string; label: string; icon: ReactNode; roles: string[] };
type NavigationGroup = { key: string; label: string; icon: ReactNode; items: NavigationItem[] };
type MenuItem = Required<MenuProps>['items'][number];

const NAVIGATION_GROUPS: NavigationGroup[] = [
  {
    key: 'operations', label: 'Vận hành', icon: <AppstoreOutlined />,
    items: [
      { to: '/dashboard', label: 'Điều phối', icon: <HomeOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'] },
      { to: '/docks', label: 'Quản lý dock', icon: <AppstoreOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'] },
      { to: '/check-in', label: 'Check-in', icon: <LoginOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'CHECKIN'] },
    ],
  },
  {
    key: 'analytics', label: 'Phân tích', icon: <BarChartOutlined />,
    items: [
      { to: '/receiving-times', label: 'Thời gian nhận hàng', icon: <BarChartOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING'] },
      { to: '/reports', label: 'Báo cáo', icon: <FileTextOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'] },
      { to: '/histories', label: 'Lịch sử', icon: <HistoryOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE'] },
    ],
  },
  {
    key: 'administration', label: 'Quản trị', icon: <SettingOutlined />,
    items: [
      { to: '/backoffice', label: 'Backoffice', icon: <SettingOutlined />, roles: ['SUPERADMIN', 'ADMIN_LOC'] },
      { to: '/superadmin', label: 'Superadmin', icon: <BulbOutlined />, roles: ['SUPERADMIN'] },
    ],
  },
];

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin', ADMIN_LOC: 'Admin khu vực', ADMIN_OPE: 'Admin vận hành', RECEIVING: 'Nhận hàng', CHECKIN: 'Check-in',
};

function initials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2);
}

function pathIsActive(pathname: string, destination: string) {
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

export default function StaffShell({ children }: { children: ReactNode }) {
  const { user, hasRole, logout } = useAuth();
  const { mall } = useBranding();
  const { mode, toggleMode } = useThemeMode();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const groups = useMemo(() => NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasRole(...item.roles)),
  })).filter((group) => group.items.length > 0), [hasRole]);
  const activeItem = groups.flatMap((group) => group.items).find((item) => pathIsActive(location.pathname, item.to));
  const homePath = user?.role === 'CHECKIN' ? '/check-in' : '/dashboard';
  const headerItems = useMemo<MenuItem[]>(() => groups.map((group) => ({
    key: group.key,
    label: group.label,
    icon: group.icon,
    children: group.items.map((item) => ({ key: item.to, icon: item.icon, label: item.label })),
  })), [groups]);

  function go(destination: string) {
    setDrawerOpen(false);
    navigate(destination);
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const accountMenu: MenuProps = {
    items: [
      { key: 'role', label: ROLE_LABELS[user?.role ?? ''] ?? user?.role, disabled: true },
      { type: 'divider' },
      { key: 'logout', label: 'Đăng xuất', icon: <LoginOutlined /> },
    ],
    onClick: ({ key }) => { if (key === 'logout') void handleLogout(); },
  };

  const drawerItems: MenuProps['items'] = groups.map((group) => ({
    key: `${group.key}-heading`,
    type: 'group',
    label: group.label,
    children: group.items.map((item) => ({ key: item.to, icon: item.icon, label: item.label })),
  }));

  return (
    <Layout className="min-h-screen" style={{ background: token.colorBgLayout }}>
      <Layout.Header
        className="sticky top-0 z-50 flex h-16 items-center gap-2 px-3 sm:px-5"
        style={{ background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Button type="text" icon={<MenuOutlined />} aria-label="Mở menu" className="xl:hidden" onClick={() => setDrawerOpen(true)} />
        <Link to={homePath} className="flex min-w-0 items-center gap-2.5 no-underline" aria-label="Trang chủ vận hành">
          {mall.logoUrl ? <img src={mall.logoUrl} alt={mall.mallName} className="h-9 w-9 rounded-lg object-contain" /> : <Avatar shape="square" size={36} icon={<HomeOutlined />} />}
          <span className="hidden max-w-48 truncate text-sm font-bold sm:block" style={{ color: token.colorText }}>{mall.mallName}</span>
        </Link>

        <div className="hidden min-w-0 flex-1 self-stretch xl:flex">
          <ConfigProvider
            theme={{
              components: {
                Menu: {
                  horizontalItemHoverColor: token.colorPrimary,
                  horizontalItemSelectedColor: token.colorPrimary,
                  itemHoverColor: token.colorPrimary,
                  itemSelectedColor: token.colorPrimary,
                  subMenuItemSelectedColor: token.colorPrimary,
                },
              },
            }}
          >
            <Menu
              mode="horizontal"
              selectedKeys={activeItem ? [activeItem.to] : []}
              items={headerItems}
              triggerSubMenuAction="hover"
              onClick={({ key }) => go(key)}
              className="h-full min-w-0 flex-1 justify-center"
              style={{ background: 'transparent', borderBottom: 0 }}
            />
          </ConfigProvider>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {!screens.xl && activeItem && <Typography.Text ellipsis className="hidden max-w-40 text-sm sm:block">{activeItem.label}</Typography.Text>}
          <Tooltip title={mode === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}>
            <Button type="text" icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />} onClick={toggleMode} aria-label={mode === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'} />
          </Tooltip>
          <Dropdown menu={accountMenu} trigger={['click']}>
            <Button type="text" className="h-auto px-1"><Space size={8}><Avatar size="small" icon={<UserOutlined />}>{user ? initials(user.name) : undefined}</Avatar><span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{user?.name}</span><DownOutlined className="hidden text-xs sm:inline" /></Space></Button>
          </Dropdown>
        </div>
      </Layout.Header>

      <Layout.Content>{children}</Layout.Content>

      <Drawer title="Điều hướng" placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={304} styles={{ body: { padding: 0 } }}>
        <Menu mode="inline" selectedKeys={activeItem ? [activeItem.to] : []} items={drawerItems} onClick={({ key }) => go(key)} />
      </Drawer>
    </Layout>
  );
}
