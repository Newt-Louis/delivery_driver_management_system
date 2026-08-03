import { EmptyState, StatusBadge, TableShell } from './shared';

export default function DevicesTab({ devices }: { devices: any[] }) {
  if (devices.length === 0) return <EmptyState />;
  return (
    <TableShell>
      <table className="w-full text-sm">
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} className="border-t border-thiso-100">
              <td className="p-3 font-mono">{device.code}</td><td className="p-3">{device.name}</td><td className="p-3">{device.deviceType}</td><td className="p-3"><StatusBadge active={device.isActive} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  );
}
