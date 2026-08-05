import CheckInForm from '../features/check-in/components/CheckInForm';
import CheckInResultCard from '../features/check-in/components/CheckInResultCard';
import WaitingListCard from '../features/check-in/components/WaitingListCard';
import { useCheckIn } from '../features/check-in/hooks/useCheckIn';

export default function CheckIn() {
  const {
    input,
    mode,
    result,
    error,
    loading,
    waitingList,
    changeInput,
    changeMode,
    submitCheckIn,
    exportWaitingList,
  } = useCheckIn();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="section-heading mb-1">Bảo vệ / Security</div>
        <h1 className="page-title">Check-in xe vào cổng</h1>
      </div>

      <div className="card mb-4">
        <CheckInForm
          input={input}
          mode={mode}
          loading={loading}
          onInputChange={changeInput}
          onModeChange={changeMode}
          onSubmit={submitCheckIn}
        />

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {result && <CheckInResultCard delivery={result} />}
      </div>

      <WaitingListCard waitingList={waitingList ?? []} onExport={exportWaitingList} />
    </div>
  );
}
