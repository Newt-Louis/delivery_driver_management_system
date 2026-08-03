import { EmptyState, StatusBadge, TableShell } from './shared';

export default function TimeWindowsTab({ timeWindows }: { timeWindows: any[] }) {
  if (timeWindows.length === 0) return <EmptyState />;
  return (
    <TableShell>
      <table className="w-full text-sm">
        <tbody>
          {timeWindows.map((item) => (
            <tr key={item.id} className="border-t border-thiso-100">
              <td className="p-3">{item.unit}</td><td className="p-3">{item.goodsType}</td><td className="p-3">{item.label ?? '-'}</td><td className="p-3">{item.startTime} - {item.endTime}</td><td className="p-3"><StatusBadge active={item.enabled} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
