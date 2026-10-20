import { useState, type ReactNode } from 'react';
import { MenuOutlined } from '@ant-design/icons';
import { Button, Drawer, Grid, Layout, Menu, Typography, theme, type MenuProps } from 'antd';
import { useThemeMode } from '../../context/ThemeModeContext';

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
        <Layout.Sider width={248} theme={mode} style={{ background: token.colorBgContainer, borderRight: `1px solid ${token.colorBorderSecondary}` }}>
          <div className="px-5 py-4"><Typography.Text strong>{title}</Typography.Text></div>
          {sectionMenu}
        </Layout.Sider>
      )}

      <Layout.Content className="min-w-0">
        {!screens.lg && (
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Button icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)}>Danh mục</Button>
            <Typography.Text strong ellipsis>{title}</Typography.Text>
          </div>
        )}
        {children}
      </Layout.Content>

      <Drawer title={title} placement="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={304} styles={{ body: { padding: 0 } }}>
        {sectionMenu}
      </Drawer>
    </Layout>
  );
}
