import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { prisma } from '../lib/prisma';
import { AuthSessionError, verifyAccessToken, type SafeAuthUser } from '../services/authSession';
import { getRedis } from '../services/redis';
import { invalidateUserUnitPermissionCache } from '../services/unitPermission';

let io: SocketServer;

export type SocketScope = {
  businessLocationId?: string;
  unitConfigId?: string;
};

type JoinRealtimeScopePayload = SocketScope & {
  dashboard?: boolean;
  waitingScreen?: boolean;
  token?: string;
};

const PING_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_MISSED_PONGS = 5;

interface DisconnectedEntry {
  userId: string;
  timer: ReturnType<typeof setTimeout>;
  missedPongs: number;
}

const disconnectedSockets = new Map<string, DisconnectedEntry>();

function uniq(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

export async function cleanupUserRedisData(userId: string): Promise<void> {
  const redis = await getRedis();

  // Remove all sessions for this user
  const sessionIds = await redis.sMembers(`auth:user:${userId}:sessions`);
  for (const sid of sessionIds) {
    await redis.del(`auth:session:${sid}`);
  }
  await redis.del(`auth:user:${userId}:sessions`);

  // Remove profile + permission caches
  await redis.del(`auth:user:${userId}:profile`);
  await invalidateUserUnitPermissionCache(userId);

  console.log(`[socket] Cleaned up Redis data for user ${userId}`);
}

function startDisconnectTimer(socketId: string, userId: string): void {
  const existing = disconnectedSockets.get(socketId);
  if (existing) {
    clearTimeout(existing.timer);
    disconnectedSockets.delete(socketId);
  }

  const entry: DisconnectedEntry = {
    userId,
    timer: setTimeout(async () => {
      const e = disconnectedSockets.get(socketId);
      if (!e) return;

      e.missedPongs++;
      if (e.missedPongs >= MAX_MISSED_PONGS) {
        disconnectedSockets.delete(socketId);
        try {
          await cleanupUserRedisData(e.userId);
        } catch (err) {
          console.error(`[socket] Failed to cleanup Redis for user ${e.userId}`, err);
        }
      } else {
        // Restart timer for next ping cycle
        startDisconnectTimer(socketId, userId);
      }
    }, PING_INTERVAL_MS),
    missedPongs: 0,
  };

  disconnectedSockets.set(socketId, entry);
}

function cancelDisconnectTimer(socketId: string): void {
  const entry = disconnectedSockets.get(socketId);
  if (entry) {
    clearTimeout(entry.timer);
    disconnectedSockets.delete(socketId);
  }
}

export function initSocket(server: HttpServer): SocketServer {
  io = new SocketServer(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: PING_INTERVAL_MS,
    pingTimeout: 20_000,
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // If this socket reconnects, cancel any pending disconnect cleanup
    cancelDisconnectTimer(socket.id);

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
        if (payload.dashboard) {
          const user = await verifyProtectedSocketPayload(payload);
          socket.data = { ...socket.data, userId: user.id };
        }
        const scope = await validateSocketScope(payload);
        if (!scope.businessLocationId && !scope.unitConfigId) {
          ack?.({ ok: false, error: 'missing_scope' });
          return;
        }

        const rooms = scopedRooms(scope, {
          dashboard: payload.dashboard,
          waitingScreen: payload.waitingScreen,
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
      });
      rooms.forEach((room) => socket.leave(room));
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
      // Try to resolve userId from socket data before starting timer
      // userId is stored via socket.data when connection is established with valid token
      const userId = (socket.data as { userId?: string })?.userId;
      if (userId) {
        startDisconnectTimer(socket.id, userId);
      }
    });
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

async function verifyProtectedSocketPayload(payload: JoinRealtimeScopePayload): Promise<SafeAuthUser> {
  const token = payload.token?.trim();
  if (!token) throw new Error('missing_socket_token');
  const result = await verifyAccessToken(token);
  return result.user;
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

function scopedRooms(scope: SocketScope, options: { dashboard?: boolean; waitingScreen?: boolean } = {}): string[] {
  const businessLocationId = scope.businessLocationId ?? undefined;
  return uniq([
    businessLocationId ? businessLocationRoomName(businessLocationId) : null,
    scope.unitConfigId ? unitConfigRoomName(scope.unitConfigId) : null,
    businessLocationId && options.dashboard ? dashboardRoomName(businessLocationId) : null,
    businessLocationId && options.waitingScreen ? waitingScreenRoomName(businessLocationId) : null,
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
