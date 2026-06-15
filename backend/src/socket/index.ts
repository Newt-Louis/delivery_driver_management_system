import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function emitQueueUpdated(queue: unknown[]): void {
  getIO().emit('queue_updated', queue);
}

export function emitDeliveryCalled(data: {
  id: string;
  vehiclePlate: string;
  slotCode: string;
  slotName: string;
  message: string;
  receivingUnit?: string;
  callCount?: number;
  isAutoAssign?: boolean;
  ticketCode?: string;
}): void {
  getIO().emit('delivery_called', data);
}

export function emitSlotUpdated(slots: unknown[]): void {
  getIO().emit('slot_updated', slots);
}

export function emitDeliveryCompleted(id: string): void {
  getIO().emit('delivery_completed', { id });
}
