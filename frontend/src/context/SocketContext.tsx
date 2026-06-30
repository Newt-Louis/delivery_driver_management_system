import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import api from '../lib/api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? '';

const SocketContext = createContext<Socket | null>(null);
export type RealtimeScope = { businessLocationId?: string; unitConfigId?: string };
const RealtimeScopeContext = createContext<RealtimeScope>({});

function screenFlags(pathname: string) {
  return {
    dashboard: pathname.startsWith('/dashboard') || pathname.startsWith('/docks'),
    waitingScreen: pathname.startsWith('/waiting-screen'),
    kiosk: pathname.startsWith('/kiosk'),
  };
}

async function resolveRealtimeScope(search: string): Promise<RealtimeScope> {
  const params = new URLSearchParams(search);
  const businessLocationId = params.get('businessLocationId') ?? params.get('locationId') ?? undefined;
  const unitConfigId = params.get('unitConfigId') ?? undefined;
  if (businessLocationId || unitConfigId) return { businessLocationId, unitConfigId };

  const res = await api.get('/api/brand');
  const mall = res.data?.mall;
  return { businessLocationId: mall?.id };
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const location = useLocation();
  const [scope, setScope] = useState<RealtimeScope>({});

  if (!socketRef.current) {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      auth: { token: localStorage.getItem('token') ?? undefined },
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
    let cancelled = false;
    let joinedPayload: (RealtimeScope & ReturnType<typeof screenFlags>) | null = null;

    async function joinScope() {
      try {
        const nextScope = await resolveRealtimeScope(location.search);
        if (cancelled) return;
        setScope(nextScope);
        if (!nextScope.businessLocationId && !nextScope.unitConfigId) return;

        joinedPayload = { ...nextScope, ...screenFlags(location.pathname) };
        const emitJoin = () => socket.emit('realtime:join', joinedPayload);
        if (socket.connected) emitJoin();
        else socket.once('connect', emitJoin);
      } catch {
        if (!cancelled) setScope({});
      }
    }

    joinScope();
    return () => {
      cancelled = true;
      if (joinedPayload) socket.emit('realtime:leave', joinedPayload);
    };
  }, [location.pathname, location.search]);

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
