import { EmptyState, TableShell } from './shared';

export default function ReceivingTimesTab({ receivingTimes }: { receivingTimes: any[] }) {
  if (receivingTimes.length === 0) return <EmptyState />;
  return (
    <TableShell>
      <table className="w-full text-sm">
        <tbody>
          {receivingTimes.map((item) => (
            <tr key={item.id} className="border-t border-thiso-100">
              <td className="p-3">{item.unit}</td><td className="p-3">{item.vehicleType}</td><td className="p-3">{item.goodsType}</td><td className="p-3">{item.configuredMinutes} phút</td><td className="p-3">{item.recommendedMinutes ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
