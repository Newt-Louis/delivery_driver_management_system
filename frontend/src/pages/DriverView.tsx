import { useBranding } from '../context/BrandingContext';
import AppNotifications from '../features/driver-view/components/AppNotifications';
import CompletedDeliveryCard from '../features/driver-view/components/CompletedDeliveryCard';
import DriverDeliveryCard from '../features/driver-view/components/DriverDeliveryCard';
import DriverGuideCard from '../features/driver-view/components/DriverGuideCard';
import DriverHeader from '../features/driver-view/components/DriverHeader';
import DriverHero from '../features/driver-view/components/DriverHero';
import EmptyPlateState from '../features/driver-view/components/EmptyPlateState';
import NotificationPermissionCard from '../features/driver-view/components/NotificationPermissionCard';
import PlateSearchCard from '../features/driver-view/components/PlateSearchCard';
import { useDriverView } from '../features/driver-view/hooks/useDriverView';

export default function DriverView() {
  const { mall } = useBranding();
  const {
    plate,
    inputPlate,
    setInputPlate,
    allDeliveries,
    notifGranted,
    notifications,
    now,
    lastUpdated,
    myDeliveries,
    myActive,
    myCompleted,
    submitPlate,
    clearPlate,
    enableNotifications,
  } = useDriverView();

  return (
    <div className="min-h-screen bg-thiso-50 font-sans">
      <DriverHeader mall={mall} now={now} />
      <AppNotifications notifications={notifications} />

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        <DriverHero mall={mall} />
        <PlateSearchCard
          plate={plate}
          inputPlate={inputPlate}
          onInputPlateChange={setInputPlate}
          onSubmit={submitPlate}
          onClear={clearPlate}
        />
        <NotificationPermissionCard notifGranted={notifGranted} onEnable={enableNotifications} />

        {plate && myActive.length === 0 && myDeliveries.length === 0 && (
          <EmptyPlateState plate={plate} />
        )}

        {myActive.map((delivery) => (
          <DriverDeliveryCard
            key={delivery.id}
            delivery={delivery}
            allDeliveries={allDeliveries}
            lastUpdated={lastUpdated}
          />
        ))}

        {myCompleted.map((delivery) => (
          <CompletedDeliveryCard key={delivery.id} delivery={delivery} />
        ))}

        <DriverGuideCard />

        <div className="text-center text-thiso-400 text-xs pb-4">
          {mall.mallName}
        </div>
      </div>
    </div>
  );
}
