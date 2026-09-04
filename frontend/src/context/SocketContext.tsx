import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../lib/api';
import { getAuthToken } from '../lib/authCookies';
import { useAuth } from './AuthContext';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

const SocketContext = createContext<Socket | null>(null);
export type RealtimeScope = { businessLocationId?: string; unitConfigId?: string };
const RealtimeScopeContext = createContext<RealtimeScope>({});

function screenFlags(pathname: string) {
  return {
    dashboard: pathname.startsWith('/dashboard') || pathname.startsWith('/docks'),
    waitingScreen: pathname.startsWith('/waiting-screen'),
  };
}

async function resolveRealtimeScope(
  pathname: string,
  search: string,
  authenticatedBusinessLocationId?: string,
): Promise<RealtimeScope> {
  const params = new URLSearchParams(search);
  const businessLocationId = params.get('businessLocationId') ?? params.get('locationId') ?? undefined;
  const unitConfigId = params.get('unitConfigId') ?? undefined;
  const flags = screenFlags(pathname);

  if (flags.dashboard) {
    return { businessLocationId: authenticatedBusinessLocationId, unitConfigId };
  }
  if (businessLocationId || unitConfigId) return { businessLocationId, unitConfigId };
  if (!flags.waitingScreen) return {};

  const res = await api.get('/api/brand');
  const mall = res.data?.mall;
  return { businessLocationId: mall?.id };
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const location = useLocation();
  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const [scope, setScope] = useState<RealtimeScope>({});

  if (!socketRef.current) {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token: getAuthToken() ?? undefined },
    });
  }

  useEffect(() => {
    const socket = socketRef.current!;
    socket.connect();
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    const socket = socketRef.current!;
    const handleScopeChanged = () => { void logout(); };
    socket.on('auth_scope_changed', handleScopeChanged);
    return () => {
      socket.off('auth_scope_changed', handleScopeChanged);
    };
  }, [logout]);

  useEffect(() => {
    const socket = socketRef.current!;
    let cancelled = false;
    let joinedPayload: (RealtimeScope & ReturnType<typeof screenFlags> & { token?: string }) | null = null;

    async function joinScope() {
      try {
        const flags = screenFlags(location.pathname);
        if (flags.dashboard && isAuthLoading) return;

        const nextScope = await resolveRealtimeScope(
          location.pathname,
          location.search,
          user?.businessLocationId ?? undefined,
        );
        if (cancelled) return;
        setScope(nextScope);
        if (!nextScope.businessLocationId && !nextScope.unitConfigId) return;

        joinedPayload = {
          ...nextScope,
          ...flags,
          ...(flags.dashboard ? { token: getAuthToken() ?? undefined } : {}),
        };
        if (socket.connected) onConnect();
        else socket.connect();
      } catch {
        if (!cancelled) setScope({});
      }
    }

    joinScope();

    // Socket.IO emits connect both initially and after a reconnect.
    function onConnect() {
      if (!cancelled && joinedPayload) {
        socket.auth = { token: getAuthToken() ?? undefined };
        socket.emit('realtime:join', joinedPayload);
      }
    }
    socket.on('connect', onConnect);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      if (joinedPayload) socket.emit('realtime:leave', joinedPayload);
    };
  }, [isAuthLoading, location.pathname, location.search, user?.businessLocationId]);

  return (
    <SocketContext.Provider value={socketRef.current}>
      <RealtimeScopeContext.Provider value={scope}>
        {children}
      </RealtimeScopeContext.Provider>
    </SocketContext.Provider>
  );
}

export function useSocket(): Socket {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

export function useRealtimeScope(): RealtimeScope {
  return useContext(RealtimeScopeContext);
}
