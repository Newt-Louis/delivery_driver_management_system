import { useParams } from 'react-router-dom';
import { useTrackContent } from '../features/track/hooks/useTrackContent';
import TrackLookup from '../features/track/components/TrackLookup';
import StatusAlertOverlay from '../features/track/components/StatusAlertOverlay';
import QueueBanner from '../features/track/components/QueueBanner';
import TrackHeader from '../features/track/components/TrackHeader';
import NotificationBanners from '../features/track/components/NotificationBanners';
import StatusCard from '../features/track/components/StatusCard';
import QueuePositionCard from '../features/track/components/QueuePositionCard';
import QrSection from '../features/track/components/QrSection';
import DeliveryInfoCard from '../features/track/components/DeliveryInfoCard';
import JourneyTimeline from '../features/track/components/JourneyTimeline';
import TrackFooter from '../features/track/components/TrackFooter';

export default function Track() {
  const { code } = useParams<{ code: string }>();
  if (!code) return <TrackLookup />;
  return <TrackContent code={code} />;
}

function TrackContent({ code }: { code: string }) {
  const hook = useTrackContent(code);

  if (hook.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-thiso-50">
        <p className="text-thiso-400 text-sm animate-pulse">Đang tải...</p>
      </div>
    );
  }

  if (hook.fetchErr || !hook.delivery) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-thiso-50 p-8 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <p className="font-bold text-thiso-700">Không tìm thấy lượt đăng ký</p>
        <p className="text-thiso-400 text-sm mt-1 font-mono">{code}</p>
      </div>
    );
  }

  const { delivery, si, isTerminal, isUrgentQueue, unitMeta, statusAlert, setStatusAlert, stopCalledAlerts, queueBanner, setQueueBanner, qrDataUrl, qrExpanded, setQrExpanded, notifPermission, pushEnabled, deviceAlertsReady, pushSupport, wakeLockActive, primeDeviceAlerts, requestNotif } = hook;

  return (
    <div className="min-h-screen bg-thiso-50 flex flex-col">
      {statusAlert && (
        <StatusAlertOverlay
          statusAlert={statusAlert}
          onClose={() => { setStatusAlert(null); stopCalledAlerts(); }}
        />
      )}

      {queueBanner && (
        <QueueBanner queueBanner={queueBanner} onClose={() => setQueueBanner(null)} />
      )}

      <TrackHeader delivery={delivery} unitMeta={unitMeta!} isUrgentQueue={isUrgentQueue} />

      <div
        className="flex-1 overflow-y-auto px-4 py-4 max-w-md mx-auto w-full space-y-4"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }}
      >
        <NotificationBanners
          isTerminal={isTerminal}
          pushSupport={pushSupport}
          notifPermission={notifPermission}
          pushEnabled={pushEnabled}
          deviceAlertsReady={deviceAlertsReady}
          onRequestNotif={requestNotif}
          onPrimeAlerts={primeDeviceAlerts}
        />

        <StatusCard delivery={delivery} si={si} isTerminal={isTerminal} />

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
    </div>
  );
}
