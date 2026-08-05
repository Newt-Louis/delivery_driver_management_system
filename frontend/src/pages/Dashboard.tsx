import type { UnitDispatch } from '../lib/types';
import AllTabView from '../features/dashboard/components/AllTabView';
import CallModal from '../features/dashboard/components/CallModal';
import CancelReasonModal from '../features/dashboard/components/CancelReasonModal';
import DashboardAlerts from '../features/dashboard/components/DashboardAlerts';
import DashboardHeader from '../features/dashboard/components/DashboardHeader';
import DashboardLegend from '../features/dashboard/components/DashboardLegend';
import DashboardTabs from '../features/dashboard/components/DashboardTabs';
import DeliveryDetailModal from '../features/dashboard/components/DeliveryDetailModal';
import KpiSummary from '../features/dashboard/components/KpiSummary';
import LoadingState from '../features/dashboard/components/LoadingState';
import UnitTabView from '../features/dashboard/components/UnitTabView';
import { useDashboard } from '../features/dashboard/hooks/useDashboard';

export default function Dashboard() {
  const {
    activeTab,
    setActiveTab,
    summary,
    dispatch,
    isLoading,
    callTarget,
    callPreSlot,
    callLoading,
    actionLoading,
    viewId,
    cancelTargetId,
    allSlots,
    tabs,
    totalWaiting,
    invalidateAll,
    doCall,
    doAction,
    openCallModal,
    closeCallModal,
    openCallBySuggestion,
    setViewId,
    closeViewModal,
    closeCancelModal,
  } = useDashboard();

  const activeUnitDispatch = activeTab !== 'ALL' && dispatch
    ? dispatch[activeTab] as UnitDispatch | undefined
    : undefined;

  return (
    <div className="max-w-screen-xl mx-auto py-5 px-4">
      {callTarget && (
        <CallModal
          delivery={callTarget}
          slots={allSlots}
          preselectedSlotId={callPreSlot}
          onClose={closeCallModal}
          onCall={doCall}
          loading={callLoading}
        />
      )}

      {viewId && (
        <DeliveryDetailModal
          id={viewId}
          onClose={closeViewModal}
          onCall={(delivery) => { closeViewModal(); openCallModal(delivery); }}
          onAction={(id, action) => { closeViewModal(); doAction(id, action); }}
        />
      )}

      {cancelTargetId && (
        <CancelReasonModal
          onClose={closeCancelModal}
          onSubmit={(reason) => doAction(cancelTargetId, 'cancel', reason)}
          loading={actionLoading === cancelTargetId + 'cancel'}
        />
      )}

      <DashboardHeader />
      <DashboardAlerts summary={summary} onExpireDone={invalidateAll} />
      <KpiSummary summary={summary} />
      <DashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        dispatch={dispatch}
        totalWaiting={totalWaiting}
        onChange={setActiveTab}
      />

      {isLoading && <LoadingState />}

      {!isLoading && activeTab === 'ALL' && dispatch && (
        <AllTabView
          dispatch={dispatch}
          onCall={openCallModal}
          onAction={doAction}
          onView={setViewId}
          actionLoading={actionLoading}
        />
      )}

      {!isLoading && activeTab !== 'ALL' && (
        <UnitTabView
          unit={activeTab}
          unitDispatch={activeUnitDispatch}
          actionLoading={actionLoading}
          onSuggestionAction={openCallBySuggestion}
          onCall={openCallModal}
          onAction={doAction}
          onView={setViewId}
        />
      )}

      <DashboardLegend />
    </div>
  );
}
