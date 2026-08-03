import { TableShell } from './shared';

export default function ZonesTab({ zones }: { zones: any[] }) {
  return (
    <TableShell>
      <table className="w-full text-sm">
        <thead className="bg-thiso-50 text-thiso-500">
          <tr><th className="text-left p-3">Code</th><th className="text-left p-3">Tên</th><th className="text-left p-3">Unit</th><th className="text-left p-3">Slots</th></tr>
        </thead>
        <tbody>
          {zones.map((zone) => (
            <tr key={zone.id} className="border-t border-thiso-100">
              <td className="p-3 font-mono">{zone.code}</td>
              <td className="p-3">{zone.name}</td>
              <td className="p-3">{zone.unitConfig?.unit}</td>
              <td className="p-3">{zone._count?.slots ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
