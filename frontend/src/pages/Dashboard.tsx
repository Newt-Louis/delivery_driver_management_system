import { Alert, Button, Space } from 'antd';
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
    summaryError, dispatchError, retrySummary, retryDispatch,
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
  const unitConfigsByUnit = dispatch
    ? Object.fromEntries(
      Object.entries(dispatch).map(([unit, unitDispatch]) => [unit, (unitDispatch as UnitDispatch).unitConfig]),
    )
    : {};
  const callTargetUnitConfig = callTarget
    ? callTarget.unitConfig
      ?? callTarget.assignedSlot?.zone?.unitConfig
      ?? unitConfigsByUnit[callTarget.receivingUnit]
    : undefined;

  return (
    <div className="max-w-screen-xl mx-auto py-5 px-4">
      {callTarget && (
        <CallModal
          delivery={callTarget}
          slots={allSlots}
          preselectedSlotId={callPreSlot}
          unitConfig={callTargetUnitConfig}
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
      <Space direction="vertical" style={{ width: '100%' }}>
        {summaryError && <Alert type="error" showIcon message="Không thể tải số liệu tổng quan" action={<Button onClick={() => retrySummary()}>Thử lại</Button>} />}
        {dispatchError && <Alert type="error" showIcon message="Không thể tải dữ liệu điều phối" action={<Button onClick={() => retryDispatch()}>Thử lại</Button>} />}
      </Space>
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
