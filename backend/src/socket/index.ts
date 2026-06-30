import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../lib/prisma';

let io: SocketServer;

export type SocketScope = {
  businessLocationId?: string;
  unitConfigId?: string;
};

type JoinRealtimeScopePayload = SocketScope & {
  dashboard?: boolean;
  waitingScreen?: boolean;
  kiosk?: boolean;
};

function uniq(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.on('track:join', (rawCode: unknown, ack?: (res: { ok: boolean; room?: string; error?: string }) => void) => {
      const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
      if (!code) {
        ack?.({ ok: false, error: 'missing_registration_code' });
        return;
      }
      const room = trackRoomName(code);
      socket.join(room);
      ack?.({ ok: true, room });
    });

    socket.on('track:leave', (rawCode: unknown) => {
      const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
      if (code) socket.leave(trackRoomName(code));
    });

    socket.on('realtime:join', async (
      payload: JoinRealtimeScopePayload,
      ack?: (res: { ok: boolean; rooms?: string[]; error?: string }) => void,
    ) => {
      try {
        const scope = await validateSocketScope(payload);
        if (!scope.businessLocationId && !scope.unitConfigId) {
          ack?.({ ok: false, error: 'missing_scope' });
          return;
        }

        const rooms = scopedRooms(scope, {
          dashboard: payload.dashboard,
          waitingScreen: payload.waitingScreen,
          kiosk: payload.kiosk,
        });
        rooms.forEach((room) => socket.join(room));
        ack?.({ ok: true, rooms });
      } catch {
        ack?.({ ok: false, error: 'invalid_scope' });
      }
    });

    socket.on('realtime:leave', (payload: JoinRealtimeScopePayload) => {
      const rooms = scopedRooms(payload, {
        dashboard: payload.dashboard,
        waitingScreen: payload.waitingScreen,
        kiosk: payload.kiosk,
      });
      rooms.forEach((room) => socket.leave(room));
    });

    socket.on('disconnect', () => console.log(`Client disconnected: ${socket.id}`));
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

async function validateSocketScope(payload: SocketScope): Promise<SocketScope> {
  if (payload.unitConfigId) {
    const unitConfig = await prisma.unitConfig.findUnique({
      where: { id: payload.unitConfigId },
      select: { id: true, businessLocationId: true },
    });
    if (!unitConfig) throw new Error('invalid_unit_config');
    if (payload.businessLocationId && payload.businessLocationId !== unitConfig.businessLocationId) {
      throw new Error('scope_mismatch');
    }
    return { unitConfigId: unitConfig.id, businessLocationId: unitConfig.businessLocationId };
  }

  if (payload.businessLocationId) {
    const location = await prisma.businessLocation.findUnique({
      where: { id: payload.businessLocationId },
      select: { id: true },
    });
    if (!location) throw new Error('invalid_business_location');
    return { businessLocationId: location.id };
  }

  return {};
}

export function businessLocationRoomName(businessLocationId: string): string {
  return `business-location:${businessLocationId}`;
}

export function unitConfigRoomName(unitConfigId: string): string {
  return `unit-config:${unitConfigId}`;
}

export function dashboardRoomName(businessLocationId: string): string {
  return `dashboard:${businessLocationId}`;
}

export function waitingScreenRoomName(businessLocationId: string): string {
  return `waiting-screen:${businessLocationId}`;
}

export function kioskRoomName(businessLocationId: string): string {
  return `kiosk:${businessLocationId}`;
}

function scopedRooms(scope: SocketScope, options: { dashboard?: boolean; waitingScreen?: boolean; kiosk?: boolean } = {}): string[] {
  const businessLocationId = scope.businessLocationId ?? undefined;
  return uniq([
    businessLocationId ? businessLocationRoomName(businessLocationId) : null,
    scope.unitConfigId ? unitConfigRoomName(scope.unitConfigId) : null,
    businessLocationId && options.dashboard ? dashboardRoomName(businessLocationId) : null,
    businessLocationId && options.waitingScreen ? waitingScreenRoomName(businessLocationId) : null,
    businessLocationId && options.kiosk ? kioskRoomName(businessLocationId) : null,
  ]);
}

function emitScoped(event: string, payload: unknown, scope?: SocketScope): void {
  const rooms = scopedRooms(scope ?? {});
  if (rooms.length === 0) {
    getIO().emit(event, payload);
    return;
  }
  getIO().to(rooms).emit(event, payload);
}

export function emitQueueUpdated(queue: unknown[], scope?: SocketScope): void {
  emitScoped('queue_updated', queue, scope);
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
}, scope?: SocketScope): void {
  emitScoped('delivery_called', data, scope);
}

export function emitSlotUpdated(slots: unknown[], scope?: SocketScope): void {
  emitScoped('slot_updated', slots, scope);
}

export function emitDeliveryCompleted(id: string, scope?: SocketScope): void {
  emitScoped('delivery_completed', { id }, scope);
}

export function trackRoomName(registrationCode: string): string {
  return `track:${registrationCode.trim().toUpperCase()}`;
}
