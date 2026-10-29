import { Alert, Button, Empty, Spin, Typography } from 'antd';
import SlotGroupSection from '../features/docks/components/SlotGroupSection';
import { useDockManagement } from '../features/docks/hooks/useDockManagement';

export default function DockManagement() {
  const { canEdit, slotGroups, handleStatusChange, isLoading, isError, retry } = useDockManagement();
  // TODO: Điều phối theo slot: xem xe và thời gian tại slot, chọn slot rồi gọi xe
  // có số thứ tự tiếp theo hoặc chỉ định xe cụ thể; chỉ gọi xe cùng loại với slot.
  return <div className="max-w-7xl mx-auto py-6 px-4">
    <Typography.Title level={2}>Quản lý slot nhận hàng</Typography.Title>
    {isLoading && <Spin tip="Đang tải slot"><div style={{ minHeight: 100 }} /></Spin>}
    {isError && <Alert type="error" showIcon message="Không thể tải slot" action={<Button onClick={() => retry()}>Thử lại</Button>} />}
    {!isLoading && !isError && slotGroups.length === 0 && <Empty description="Không có slot trong phạm vi hiện tại" />}
    {slotGroups.map((group) => <SlotGroupSection key={group.key} group={group} canEdit={canEdit} onStatusChange={handleStatusChange} />)}
  </div>;
}
