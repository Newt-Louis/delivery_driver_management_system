import { Alert, Button, Empty } from 'antd';
import ReceivingTimesFooter from '../features/receiving-times/components/ReceivingTimesFooter';
import ReceivingTimesGroupTable from '../features/receiving-times/components/ReceivingTimesGroupTable';
import ReceivingTimesHeader from '../features/receiving-times/components/ReceivingTimesHeader';
import ReceivingTimesInfo from '../features/receiving-times/components/ReceivingTimesInfo';
import ReceivingTimesLoading from '../features/receiving-times/components/ReceivingTimesLoading';
import ReceivingTimesSummary from '../features/receiving-times/components/ReceivingTimesSummary';
import { useReceivingTimes } from '../features/receiving-times/hooks/useReceivingTimes';

export default function ReceivingTimes() {
  const {
    data,
    configs,
    isLoading, isError, refetch,
    analyzing,
    acceptingAll,
    acceptingId,
    message,
    pendingCount,
    canManageConfig,
    unitGroups,
    runAnalysis,
    acceptOne,
    acceptAll,
    exportCsv,
  } = useReceivingTimes();

  return (
    <div className="max-w-screen-xl mx-auto py-6 px-4">
      <ReceivingTimesHeader
        canManageConfig={canManageConfig}
        pendingCount={pendingCount}
        analyzing={analyzing}
        acceptingAll={acceptingAll}
        message={message}
        onAnalyze={runAnalysis}
        onAcceptAll={acceptAll}
        onExport={exportCsv}
      />

      <ReceivingTimesSummary configs={configs} totalCompleted={data?.totalCompleted} />
      <ReceivingTimesInfo />

      {isError && <Alert type="error" showIcon message="Không thể tải dữ liệu" action={<Button onClick={() => refetch()}>Thử lại</Button>} />}
      {!isLoading && !isError && unitGroups.length === 0 && <Empty description="Không có dữ liệu" />}
      {isLoading ? (
        <ReceivingTimesLoading />
      ) : (
        <div className="space-y-6">
          {unitGroups.map((group) => (
            <ReceivingTimesGroupTable
              key={group.key}
              group={group}
              canManageConfig={canManageConfig}
              acceptingId={acceptingId}
              onAcceptOne={acceptOne}
            />
          ))}
        </div>
      )}

      <ReceivingTimesFooter />
    </div>
  );
}
