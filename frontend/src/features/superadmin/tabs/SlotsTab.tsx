import { TableShell } from './shared';

export default function SlotsTab({ slots }: { slots: any[] }) {
  return (
    <TableShell>
      <table className="w-full text-sm">
        <thead className="bg-thiso-50 text-thiso-500">
          <tr><th className="text-left p-3">Code</th><th className="text-left p-3">Tên</th><th className="text-left p-3">Unit</th><th className="text-left p-3">Zone</th><th className="text-left p-3">Status</th></tr>
        </thead>
        <tbody>
          {slots.map((slot) => (
            <tr key={slot.id} className="border-t border-thiso-100">
              <td className="p-3 font-mono">{slot.code}</td>
              <td className="p-3">{slot.name}</td>
              <td className="p-3">{slot.assignedUnit}</td>
              <td className="p-3">{slot.zone?.code}</td>
              <td className="p-3">{slot.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
