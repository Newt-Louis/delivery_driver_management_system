import type { ReactNode } from 'react';
import { Layout, theme } from 'antd';
import GlobalHeader from './GlobalHeader';

export default function PublicShell({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();

  return (
    <Layout className="min-h-screen" style={{ background: token.colorBgLayout }}>
      <GlobalHeader area="public" />
      <Layout.Content className="flex flex-1 flex-col">{children}</Layout.Content>
    </Layout>
  );
}
