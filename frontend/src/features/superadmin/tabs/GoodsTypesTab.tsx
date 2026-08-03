import { EmptyState, StatusBadge, TableShell } from './shared';

export default function GoodsTypesTab({ goodsTypes }: { goodsTypes: any[] }) {
  if (goodsTypes.length === 0) return <EmptyState />;
  return (
    <TableShell>
      <table className="w-full text-sm">
        <tbody>
          {goodsTypes.map((item) => (
            <tr key={item.id} className="border-t border-thiso-100">
              <td className="p-3">{item.unit}</td><td className="p-3">{item.emoji} {item.name}</td><td className="p-3">{item.baseType}</td><td className="p-3"><StatusBadge active={item.enabled} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
