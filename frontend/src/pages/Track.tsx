import { useParams } from 'react-router-dom';
import { Result, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useTrackContent } from '../features/track/hooks/useTrackContent';
import TrackLookup from '../features/track/components/TrackLookup';
import QueueBanner from '../features/track/components/QueueBanner';
import FollowTripCard from '../features/driver-notifications/FollowTripCard';
import StatusCard from '../features/track/components/StatusCard';
import QueuePositionCard from '../features/track/components/QueuePositionCard';
import QrSection from '../features/track/components/QrSection';
import DeliveryInfoCard from '../features/track/components/DeliveryInfoCard';
import JourneyTimeline from '../features/track/components/JourneyTimeline';
import TrackFooter from '../features/track/components/TrackFooter';

export default function Track() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <TrackLookup />;
  return <TrackContent key={code} code={code} />;
}

function TrackContent({ code }: { code: string }) {
  const hook = useTrackContent(code);

  if (hook.loading) {
    return (
      <div className="grid min-h-[calc(100vh-60px)] place-items-center"><Spin size="large" description="Đang tải hành trình..." /></div>
    );
  }

  if (hook.fetchErr || !hook.delivery) {
    return (
      <Result className="mx-auto grid min-h-[calc(100vh-60px)] max-w-lg place-content-center" status="404" icon={<SearchOutlined />} title="Không tìm thấy lượt đăng ký" subTitle={code} />
    );
  }

  const { delivery, si, isTerminal, unitMeta, queueBanner, setQueueBanner, qrDataUrl, qrExpanded, setQrExpanded, wakeLockActive } = hook;

  return (
    <main className="min-h-[calc(100vh-60px)]">
      {queueBanner && (
        <QueueBanner queueBanner={queueBanner} onClose={() => setQueueBanner(null)} />
      )}

      <div
        className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4 sm:px-6"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
      >
        {!isTerminal && <FollowTripCard delivery={delivery} />}

        <StatusCard delivery={delivery} si={si} unitMeta={unitMeta!} isTerminal={isTerminal} />

        {delivery.status === 'WAITING' && delivery.queueInfo && (
          <QueuePositionCard queueInfo={delivery.queueInfo} />
        )}

        {!isTerminal && qrDataUrl && (
          <QrSection
            delivery={delivery}
            qrDataUrl={qrDataUrl}
            qrExpanded={qrExpanded}
            setQrExpanded={setQrExpanded}
          />
        )}

        <DeliveryInfoCard delivery={delivery} unitMeta={unitMeta!} />
        <JourneyTimeline delivery={delivery} />

        {!isTerminal && <TrackFooter wakeLockActive={wakeLockActive} />}
      </div>
    </main>
  );
}
