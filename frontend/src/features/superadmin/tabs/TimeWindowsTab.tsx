import type { DeliveryTimeWindow } from '../../../lib/types';
import ReadOnlyMasterList, { type ReadOnlyScope } from '../components/ReadOnlyMasterList';
import { StatusBadge } from './shared';
type Window = DeliveryTimeWindow & { unitConfig?: { id: string; unit: string; displayName: string; businessLocationId: string } | null; unitGoodsType?: { id: string; name: string; baseType: string } | null };
const getName = (item: Window) => item.label ?? '';
const fields = [
  { key: 'unit', title: 'Đơn vị', value: (item: Window) => item.unitConfig?.displayName ? `${item.unit} - ${item.unitConfig.displayName}` : item.unit },
  { key: 'label', title: 'Tên khung giờ', value: (item: Window) => item.label || '—' },
  { key: 'goods', title: 'Loại hàng', value: (item: Window) => item.unitGoodsType?.name ? `${item.goodsType} - ${item.unitGoodsType.name}` : item.goodsType },
  { key: 'time', title: 'Khung giờ', value: (item: Window) => `${item.startTime} - ${item.endTime}` },
  { key: 'status', title: 'Trạng thái', value: (item: Window) => <StatusBadge active={item.enabled} /> },
];
export default function TimeWindowsTab({ timeWindows, scope }: { timeWindows: Window[]; scope: ReadOnlyScope }) { return <ReadOnlyMasterList items={timeWindows} scope={scope} searchLabel="Tìm tên khung giờ" getName={getName} fields={fields} emptyLabel="Không có khung giờ phù hợp" />; }
