import { useState, type ReactNode } from 'react';
import { MenuFoldOutlined, MenuOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Button, Drawer, Grid, Layout, Menu, Typography, theme, type MenuProps } from 'antd';
import { useThemeMode } from '../../context/ThemeModeContext';
import { STAFF_HEADER_HEIGHT } from '../../theme/antTheme';

export type AdminSectionItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type AdminSectionFrameProps = {
  title: string;
  items: AdminSectionItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
  children: ReactNode;
};

export default function AdminSectionFrame({ title, items, selectedKey, onSelect, children }: AdminSectionFrameProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const screens = Grid.useBreakpoint();
  const { mode } = useThemeMode();
  const { token } = theme.useToken();
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: item.label,
    icon: item.icon,
    disabled: item.disabled,
  }));

  function select(key: string) {
    onSelect(key);
    setDrawerOpen(false);
  }

  const sectionMenu = <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={({ key }) => select(key)} />;

  return (
    <Layout className="min-h-full" style={{ background: token.colorBgLayout }}>
      {screens.lg && (
        <Layout.Sider
          width={248}
          collapsedWidth={80}
          collapsed={siderCollapsed}
          theme={mode}
          style={{
            position: 'sticky',
            top: STAFF_HEADER_HEIGHT,
            height: `calc(100vh - ${STAFF_HEADER_HEIGHT}px)`,
            overflow: 'hidden',
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div className="flex h-full min-h-0 flex-col">
            {!siderCollapsed && <div className="px-5 py-4"><Typography.Text strong>{title}</Typography.Text></div>}
            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                items={menuItems}
                inlineCollapsed={siderCollapsed}
                tooltip={siderCollapsed ? {
                  placement: 'right',
                } : false}
                onClick={({ key }) => select(key)}
              />
            </div>
            <div className="shrink-0 border-t px-2 py-2" style={{ borderColor: token.colorBorderSecondary }}>
              <Button
                type="text"
                block
                icon={siderCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setSiderCollapsed((current) => !current)}
                aria-label={siderCollapsed ? 'Mở rộng danh mục' : 'Thu gọn danh mục'}
              >
                {!siderCollapsed && 'Thu gọn'}
              </Button>
            </div>
          </div>
        </Layout.Sider>
      )}

      <Layout.Content className="m-0 min-w-0">
        {!screens.lg && (
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)}>Danh mục</Button>
            <Typography.Text strong ellipsis>{title}</Typography.Text>
          </div>
        )}
        {children}
      </Layout.Content>

      <Drawer title={title} placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} size={304} styles={{ body: { padding: 0 } }}>
        {sectionMenu}
      </Drawer>
    </Layout>
  );
}
