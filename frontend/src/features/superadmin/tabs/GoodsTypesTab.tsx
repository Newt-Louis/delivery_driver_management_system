import type { UnitGoodsType } from '../../../lib/types';
import ReadOnlyMasterList, { type ReadOnlyScope } from '../components/ReadOnlyMasterList';
import { StatusBadge } from './shared';
type Goods = UnitGoodsType & { unitConfig?: { id: string; unit: string; displayName: string; businessLocationId: string } | null };
const getName = (item: Goods) => item.name;
const fields = [
  { key: 'unit', title: 'Đơn vị', value: (item: Goods) => item.unitConfig?.displayName ? `${item.unit} - ${item.unitConfig.displayName}` : item.unit },
  { key: 'name', title: 'Tên', value: (item: Goods) => item.name },
  { key: 'base', title: 'Loại cơ sở', value: (item: Goods) => item.baseType },
  { key: 'status', title: 'Trạng thái', value: (item: Goods) => <StatusBadge active={item.enabled} /> },
];
export default function GoodsTypesTab({ goodsTypes, scope }: { goodsTypes: Goods[]; scope: ReadOnlyScope }) { return <ReadOnlyMasterList items={goodsTypes} scope={scope} searchLabel="Tìm tên loại hàng" getName={getName} fields={fields} emptyLabel="Không có loại hàng phù hợp" />; }
