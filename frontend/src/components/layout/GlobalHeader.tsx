import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  BarChartOutlined,
  BulbOutlined,
  DownOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HistoryOutlined,
  HomeOutlined,
  LoginOutlined,
  MenuOutlined,
  MoonOutlined,
  SettingOutlined,
  SunOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Avatar, Button, Drawer, Dropdown, Grid, Layout, Menu, Space, Tooltip, Typography, theme, type DropdownProps, type MenuProps } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { usePublicBusinessLocation } from '../../context/PublicBusinessLocationContext';
import { useThemeMode } from '../../context/ThemeModeContext';
import { STAFF_HEADER_HEIGHT } from '../../theme/antTheme';
import PublicBusinessLocationSelector from '../PublicBusinessLocationSelector';

type HeaderArea = 'public' | 'staff';
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

const PUBLIC_NAVIGATION = [
  { key: 'register', to: '/', label: 'Đăng ký giao hàng' },
  { key: 'manual-register', to: '/register', label: 'Đăng ký thủ công' },
  { key: 'track', to: '/track', label: 'Theo dõi chuyến' },
  { key: 'cancel', to: '/cancel', label: 'Hủy chuyến' },
  { key: 'waiting-screen', to: '/waiting-screen', label: 'Màn hình chờ' },
];

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadmin', ADMIN_LOC: 'Admin khu vực', ADMIN_OPE: 'Admin vận hành', RECEIVING: 'Nhận hàng', CHECKIN: 'Check-in',
};

const PUBLIC_MENU_CLEARANCE = 16;
const PUBLIC_MENU_MIN_WIDTH = 800;

function initials(name: string) {
  return name.split(' ').map((word) => word[0]).join('').toUpperCase().slice(0, 2);
}

function pathIsActive(pathname: string, destination: string) {
  return pathname === destination || pathname.startsWith(`${destination}/`);
}

function publicActiveKey(pathname: string) {
  if (pathname === '/register') return 'manual-register';
  if (pathname === '/track' || pathname.startsWith('/track/')) return 'track';
  if (pathname === '/cancel') return 'cancel';
  if (pathname === '/waiting-screen') return 'waiting-screen';
  return 'register';
}

export default function GlobalHeader({ area }: { area: HeaderArea }) {
  const { user, isAuthenticated, hasRole, logout } = useAuth();
  const { mall } = useBranding();
  const { selectedBusinessLocation } = usePublicBusinessLocation();
  const { mode, toggleMode } = useThemeMode();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [publicMenuFits, setPublicMenuFits] = useState(false);
  const [publicMenuWide, setPublicMenuWide] = useState(false);
  const [publicMenuSupportsHover, setPublicMenuSupportsHover] = useState(false);
  const publicHeaderRef = useRef<HTMLDivElement | null>(null);
  const publicStartRef = useRef<HTMLDivElement | null>(null);
  const publicEndRef = useRef<HTMLDivElement | null>(null);
  const publicMenuMeasureRef = useRef<HTMLDivElement | null>(null);
  const isPublic = area === 'public';

  const groups = useMemo(() => NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasRole(...item.roles)),
  })).filter((group) => group.items.length > 0), [hasRole]);
  const activeItem = groups.flatMap((group) => group.items).find((item) => pathIsActive(pathname, item.to));
  const staffHeaderItems = useMemo<MenuItem[]>(() => groups.map((group) => ({
    key: group.key,
    label: group.label,
    icon: group.icon,
    children: group.items.map((item) => ({ key: item.to, icon: item.icon, label: item.label })),
  })), [groups]);
  const publicHeaderItems = useMemo<MenuItem[]>(() => PUBLIC_NAVIGATION.map((item) => ({
    key: item.key,
    label: <Link to={item.to}>{item.label}</Link>,
  })), []);

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
      { key: 'switch-area', label: isPublic ? 'Khu vực nội bộ' : 'Khu vực bên ngoài', icon: isPublic ? <AppstoreOutlined /> : <GlobalOutlined /> },
      { type: 'divider' },
      { key: 'role', label: ROLE_LABELS[user?.role ?? ''] ?? user?.role, disabled: true },
      { type: 'divider' },
      { key: 'logout', label: 'Đăng xuất', icon: <LoginOutlined /> },
    ],
    onClick: ({ key }) => {
      if (key === 'switch-area') go(isPublic ? '/dashboard' : '/');
      if (key === 'logout') void handleLogout();
    },
  };

  const staffDrawerItems: MenuProps['items'] = groups.map((group) => ({
    key: `${group.key}-heading`, type: 'group', label: group.label,
    children: group.items.map((item) => ({ key: item.to, icon: item.icon, label: item.label })),
  }));
  const publicMenuTriggers: DropdownProps['trigger'] = publicMenuSupportsHover ? ['hover', 'click'] : ['click'];

  useEffect(() => {
    if (!isPublic) return;

    const query = window.matchMedia(`(min-width: ${PUBLIC_MENU_MIN_WIDTH}px)`);
    const update = () => setPublicMenuWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [isPublic]);

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setPublicMenuSupportsHover(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useLayoutEffect(() => {
    if (!isPublic || !publicMenuWide) return;

    const updateMenuFit = () => {
      const headerWidth = publicHeaderRef.current?.clientWidth ?? 0;
      const startWidth = publicStartRef.current?.offsetWidth ?? 0;
      const endWidth = publicEndRef.current?.offsetWidth ?? 0;
      const menuWidth = publicMenuMeasureRef.current?.scrollWidth ?? 0;
      const center = headerWidth / 2;
      const leftHalf = center - startWidth - PUBLIC_MENU_CLEARANCE;
      const rightHalf = headerWidth - center - endWidth - PUBLIC_MENU_CLEARANCE;
      const centeredMenuWidth = Math.max(0, Math.min(leftHalf, rightHalf) * 2);
      setPublicMenuFits(menuWidth > 0 && menuWidth <= centeredMenuWidth);
    };

    const observer = new ResizeObserver(updateMenuFit);
    [publicHeaderRef.current, publicStartRef.current, publicEndRef.current, publicMenuMeasureRef.current]
      .filter((element): element is HTMLDivElement => Boolean(element))
      .forEach((element) => observer.observe(element));
    updateMenuFit();
    return () => observer.disconnect();
  }, [isPublic, publicHeaderItems, publicMenuWide]);

  return (
    <>
      <Layout.Header
        className="sticky top-0 z-50 flex items-center gap-2 px-3 sm:px-5"
        style={{ height: STAFF_HEADER_HEIGHT, lineHeight: `${STAFF_HEADER_HEIGHT}px`, background: token.colorBgContainer, borderBottom: `1px solid ${token.colorBorderSecondary}` }}
      >
        {isPublic ? (
          <div ref={publicHeaderRef} className="relative mx-auto flex h-full w-full min-w-0 max-w-7xl items-center gap-2">
            <div ref={publicStartRef} className="flex min-w-0 max-w-36 items-center gap-2.5 sm:max-w-48 lg:max-w-60">
              {!publicMenuWide && <Button type="text" icon={<MenuOutlined />} aria-label="Mở menu" onClick={() => setDrawerOpen(true)} />}
              <Link to="/" aria-label="Về trang chủ" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
                <Avatar shape="square" size={36} src={selectedBusinessLocation?.logoUrl || undefined} icon={<HomeOutlined />}>{selectedBusinessLocation?.code.slice(0, 2).toUpperCase()}</Avatar>
              </Link>
              <Tooltip title={selectedBusinessLocation?.locationName ?? 'Chọn khu vực'}>
                <Typography.Text strong ellipsis className="min-w-0 max-w-24 text-sm sm:text-base lg:max-w-48">{selectedBusinessLocation?.locationName ?? 'Chọn khu vực'}</Typography.Text>
              </Tooltip>
            </div>
            {publicMenuWide && <div className="absolute left-1/2 -translate-x-1/2">
              {publicMenuFits ? (
                <Menu mode="horizontal" selectedKeys={[publicActiveKey(pathname)]} items={publicHeaderItems} className="public-header-menu border-b-0" style={{ background: 'transparent', borderBottom: 0 }} />
              ) : (
                <Dropdown menu={{ items: publicHeaderItems }} trigger={publicMenuTriggers} placement="bottom">
                  <Button type="text" icon={<MenuOutlined />}>Menu</Button>
                </Dropdown>
              )}
            </div>}
            <div ref={publicEndRef} className="ml-auto shrink-0"><HeaderAccount isAuthenticated={isAuthenticated} userName={user?.name} mode={mode} onToggleMode={toggleMode} accountMenu={accountMenu} onLogin={() => navigate('/login')} /></div>
            <div ref={publicMenuMeasureRef} aria-hidden="true" className="pointer-events-none absolute -z-10 h-0 overflow-hidden opacity-0" style={{ width: 'max-content' }}>
              <Menu mode="horizontal" selectedKeys={[]} items={publicHeaderItems} className="public-header-menu border-b-0" style={{ background: 'transparent', borderBottom: 0 }} />
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full min-w-0 items-center gap-2">
            <Button type="text" icon={<MenuOutlined />} aria-label="Mở menu" className="xl:hidden" onClick={() => setDrawerOpen(true)} />
            <Link to={user?.role === 'CHECKIN' ? '/check-in' : '/dashboard'} className="flex min-w-0 items-center gap-2.5 no-underline" aria-label="Trang chủ vận hành">
              {mall.logoUrl ? <img src={mall.logoUrl} alt={mall.mallName} className="h-9 w-9 rounded-lg object-contain" /> : <Avatar shape="square" size={36} icon={<HomeOutlined />} />}
              <span className="hidden max-w-48 truncate text-sm font-bold sm:block" style={{ color: token.colorText }}>{mall.mallName}</span>
            </Link>
            <div className="hidden min-w-0 flex-1 items-center xl:flex" style={{ height: STAFF_HEADER_HEIGHT }}>
              <Menu mode="horizontal" selectedKeys={activeItem ? [activeItem.to] : []} items={staffHeaderItems} triggerSubMenuAction="hover" onClick={({ key }) => go(key)} className="staff-header-menu min-w-0 flex-1 justify-center" style={{ background: 'transparent', borderBottom: 0 }} />
            </div>
            <HeaderAccount isAuthenticated={isAuthenticated} userName={user?.name} mode={mode} onToggleMode={toggleMode} accountMenu={accountMenu} onLogin={() => navigate('/login')} activeItemLabel={!screens.xl ? activeItem?.label : undefined} />
          </div>
        )}
      </Layout.Header>

      {isPublic && <Drawer title="Điều hướng" placement="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={304} styles={{ body: { padding: 0 } }}>
        <Menu mode="inline" selectedKeys={[publicActiveKey(pathname)]} items={publicHeaderItems} onClick={() => setDrawerOpen(false)} />
      </Drawer>}
      {!isPublic && <Drawer title="Điều hướng" placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={304} styles={{ body: { padding: 0 } }}>
        <Menu mode="inline" selectedKeys={activeItem ? [activeItem.to] : []} items={staffDrawerItems} onClick={({ key }) => go(key)} />
      </Drawer>}
      {isPublic && <PublicBusinessLocationSelector />}
    </>
  );
}

function HeaderAccount({ isAuthenticated, userName, mode, onToggleMode, accountMenu, onLogin, activeItemLabel }: {
  isAuthenticated: boolean;
  userName?: string;
  mode: 'light' | 'dark';
  onToggleMode: () => void;
  accountMenu: MenuProps;
  onLogin: () => void;
  activeItemLabel?: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-1">
      {activeItemLabel && <Typography.Text ellipsis className="hidden max-w-40 text-sm sm:block">{activeItemLabel}</Typography.Text>}
      <Tooltip title={mode === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}>
        <Button type="text" icon={mode === 'light' ? <MoonOutlined /> : <SunOutlined />} onClick={onToggleMode} aria-label={mode === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'} />
      </Tooltip>
      {isAuthenticated ? (
        <Dropdown menu={accountMenu} trigger={['click']}>
          <Button type="text" className="h-auto px-1"><Space size={8}><Avatar size="small" icon={<UserOutlined />}>{userName ? initials(userName) : undefined}</Avatar><span className="hidden max-w-32 truncate text-sm font-medium lg:inline">{userName}</span><DownOutlined className="hidden text-xs sm:inline" /></Space></Button>
        </Dropdown>
      ) : (
        <Button type="text" className="h-auto px-1" aria-label="Đăng nhập hệ thống" onClick={onLogin}><Avatar size="small" icon={<UserOutlined />} /></Button>
      )}
    </div>
  );
}
