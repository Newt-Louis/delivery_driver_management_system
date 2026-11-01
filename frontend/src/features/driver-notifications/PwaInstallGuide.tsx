import { useEffect, useState } from 'react';
import { DownloadOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Modal, Space, Steps, Typography } from 'antd';
import { useLocation } from 'react-router-dom';
import { getClientPlatform, isStandaloneWebApp } from '../../lib/platform';

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
const HIDE_KEY = 'dqm_pwa_guide_hidden';
const INSTALLED_KEY = 'dqm_pwa_installed';
function saved(key: string) { try { return localStorage.getItem(key) === '1'; } catch { return false; } }
function save(key: string) { try { localStorage.setItem(key, '1'); } catch { /* Storage may be disabled. */ } }

export default function PwaInstallGuide({ blocked, onReadyChange }: { blocked: boolean; onReadyChange: (ready: boolean) => void }) {
  const { pathname } = useLocation();
  const platform = getClientPlatform();
  const [dismissed, setDismissed] = useState(false);
  const [neverAgain, setNeverAgain] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneWebApp() || saved(INSTALLED_KEY));
  const [checked, setChecked] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [error, setError] = useState('');
  const publicRoute = ['/', '/register', '/register-manual', '/track', '/waiting-screen'].includes(pathname) || pathname.startsWith('/track/');
  const guideOpen = checked && publicRoute && (platform === 'ios' || platform === 'android') && !blocked && !installed && !saved(HIDE_KEY) && !dismissed;

  useEffect(() => {
    onReadyChange(false);
    if (!checked || guideOpen || blocked) return;
    const timer = window.setTimeout(() => onReadyChange(true), 350);
    return () => window.clearTimeout(timer);
  }, [blocked, checked, guideOpen, onReadyChange]);

  useEffect(() => {
    let disposed = false;
    const installedNow = () => { save(INSTALLED_KEY); setInstalled(true); setPrompt(null); };
    if (isStandaloneWebApp()) installedNow();
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      // This is fresh browser evidence: a previous installation may have been removed.
      setInstalled(false);
      try { localStorage.removeItem(INSTALLED_KEY); } catch { /* optional storage */ }
      setPrompt(event as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installedNow);
    const media = window.matchMedia('(display-mode: standalone)');
    const modeChanged = () => { if (isStandaloneWebApp()) installedNow(); };
    media.addEventListener('change', modeChanged);
    const nav = navigator as Navigator & { getInstalledRelatedApps?: () => Promise<Array<{ platform: string; url?: string }>> };
    const detected = nav.getInstalledRelatedApps?.().then((apps) => {
      if (!disposed && apps.some((app) => app.platform === 'webapp' && app.url === new URL('/manifest.json', location.origin).href)) installedNow();
    }).catch(() => {});
    void Promise.resolve(detected).finally(() => { if (!disposed) setChecked(true); });
    return () => {
      disposed = true;
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installedNow);
      media.removeEventListener('change', modeChanged);
    };
  }, []);

  const close = () => {
    if (neverAgain) save(HIDE_KEY);
    setDismissed(true);
  };
  const ios = platform === 'ios';
  const items = ios ? [
    { title: 'Mở website bằng Safari', description: 'Nếu đang xem qua ứng dụng khác, hãy mở liên kết trong Safari.' },
    { title: 'Chọn Chia sẻ → Thêm vào Màn hình chính', description: 'Giữ tùy chọn Mở dưới dạng ứng dụng nếu có, sau đó bấm Thêm.' },
    { title: 'Mở ứng dụng vừa thêm', description: 'Mở chuyến cần theo dõi và chọn Bật thông báo. Nếu chưa thấy chuyến, dùng mã đăng ký hoặc biển số để tìm lại.' },
  ] : [
    { title: 'Mở website bằng Chrome', description: 'Hoặc sử dụng trình duyệt trên điện thoại Android của bạn.' },
    { title: 'Chọn Cài đặt ứng dụng', description: 'Bấm nút cài đặt phía trên nếu có, hoặc mở menu ⋮ → Thêm vào Màn hình chính / Cài đặt ứng dụng.' },
    { title: 'Mở ứng dụng và chọn chuyến', description: 'Chọn Theo dõi chuyến giao hàng này rồi cho phép thông báo để nhận tin khi tới lượt.' },
  ];
  return <Modal open={guideOpen}
    focusable={{ focusTriggerAfterClose: !blocked }}
    centered width="min(760px, calc(100vw - 24px))" title={<Space orientation="vertical" size={0}>{ios ? 'Xin chào, bạn đang sử dụng iOS' : 'Xin chào, bạn đang sử dụng Android'}</Space>}
    onCancel={close} mask={{ closable: true }} footer={<Checkbox checked={neverAgain} onChange={(event) => setNeverAgain(event.target.checked)}>Không hiện lên popup này nữa</Checkbox>}
    styles={{ body: { minHeight: 'min(60dvh, 520px)', maxHeight: '72dvh', overflowY: 'auto' } }}>
    <Space orientation="vertical" size="large" className="w-full py-4">
      <Typography.Title level={3}>
        <span className="block">Bạn có muốn</span>
        <span className="block">Mở nhanh chuyến giao hàng, nhận tin khi tới lượt?</span>
      </Typography.Title>
      {ios && <Button type="primary" size="large" block icon={<DownloadOutlined />} onClick={() => setShowIosInstructions(true)}>Cài đặt ứng dụng</Button>}
      {ios && showIosInstructions && <Alert type="info" showIcon title="Trên iPhone/iPad, hãy bấm Chia sẻ trên trình duyệt → Thêm vào Màn hình chính → Thêm." description="Nếu không thấy tùy chọn này, hãy mở trang bằng Safari rồi thử lại." />}
      {!ios && prompt && <Button type="primary" size="large" block icon={<DownloadOutlined />} loading={installing} onClick={async () => {
        setInstalling(true);
        try {
          await prompt.prompt();
          const choice = await prompt.userChoice;
          if (choice.outcome === 'accepted') close();
          setPrompt(null);
        } catch { setError('Hãy dùng menu của trình duyệt để thêm ứng dụng vào Màn hình chính.'); }
        finally { setInstalling(false); }
      }}>Cài đặt ứng dụng</Button>}
      {error && <Alert type="info" showIcon title={error} />}
      <Typography.Paragraph>Bạn có thể thêm ứng dụng lên Màn hình chính để mở lại thuận tiện. Bạn vẫn có thể sử dụng website nếu chưa muốn cài.</Typography.Paragraph>
      <Steps orientation="vertical" items={items.map(({ title, description }) => ({ title, content: description }))} current={-1} />
    </Space>
  </Modal>;
}
