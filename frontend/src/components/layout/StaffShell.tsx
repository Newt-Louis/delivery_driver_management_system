import type { ReactNode } from 'react';
import { Layout, theme } from 'antd';
import GlobalHeader from './GlobalHeader';

export default function StaffShell({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();

  return (
    <Layout className="min-h-screen" style={{ background: token.colorBgLayout }}>
      <GlobalHeader area="staff" />
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
