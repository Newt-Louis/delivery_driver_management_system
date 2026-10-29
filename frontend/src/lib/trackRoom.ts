import type { Socket } from 'socket.io-client';

// The detail page and the global alert owner can share a room without either
// leaving it while the other still needs updates.
const leases = new WeakMap<Socket, Map<string, { count: number; join: () => void }>>();

export function retainTrackRoom(socket: Socket, rawCode: string): () => void {
  const code = rawCode.trim().toUpperCase();
  let rooms = leases.get(socket);
  if (!rooms) { rooms = new Map(); leases.set(socket, rooms); }
  let lease = rooms.get(code);
  if (!lease) {
    const join = () => socket.emit('track:join', code);
    lease = { count: 0, join };
    rooms.set(code, lease);
    socket.on('connect', join);
    if (socket.connected) join();
    else socket.connect();
  }
  lease.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const current = rooms.get(code);
    if (!current || --current.count > 0) return;
    socket.off('connect', current.join);
    socket.emit('track:leave', code);
    rooms.delete(code);
  };
}
