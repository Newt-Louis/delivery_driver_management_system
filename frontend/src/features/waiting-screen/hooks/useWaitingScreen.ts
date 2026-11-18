import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRealtimeScope, useSocket } from '../../../context/SocketContext';
import api from '../../../lib/api';
import type { BrandConfig, UnitKey, WaitingBoard, WaitingBoardUnit } from '../types';

export function useWaitingScreen() {
  const socket        = useSocket();
  const realtimeScope = useRealtimeScope();

  const [board, setBoard]             = useState<WaitingBoard | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now, setNow]                 = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brand, setBrand]             = useState<BrandConfig | null>(null);
  const [isMobile, setIsMobile]       = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [activeTab, setActiveTab]     = useState<UnitKey>('');
  const [view, setView]               = useState<'dark' | 'bright'>(
    () => (localStorage.getItem('ws_view') as 'dark' | 'bright') ?? 'bright',
  );

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { localStorage.setItem('ws_view', view); }, [view]);
  const toggleView = () => setView((v) => (v === 'dark' ? 'bright' : 'dark'));

  useEffect(() => {
    if (!realtimeScope.businessLocationId && !realtimeScope.unitConfigId) {
      setBrand(null);
      return;
    }
    api.get<BrandConfig>('/api/brand', { params: realtimeScope }).then((r) => setBrand(r.data)).catch(() => {});
  }, [realtimeScope]);

  useEffect(() => {
    setBoard(null);
    setHighlightId(null);
    setActiveTab('');
    setBrand(null);
  }, [realtimeScope.businessLocationId, realtimeScope.unitConfigId]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Board = slot rows (rule R1, one row per capacity place) + next-in-line waiting list, built by the server.
  const fetchBoard = useCallback(async () => {
    if (!realtimeScope.businessLocationId && !realtimeScope.unitConfigId) return;
    try {
      const response = await api.get<WaitingBoard>('/api/waiting-screen/board', { params: realtimeScope });
      setBoard(response.data);
    } catch { /* silent */ }
  }, [realtimeScope]);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);

  useEffect(() => {
    // Server pushes the whole (small) board, debounced per location, after any queue/slot change.
    const onBoard = (data: WaitingBoard) => {
      setBoard(data);
      setHighlightId((current) => {
        if (!current) return current;
        const stillShown = data.units.some((unit) => unit.slotRows.some((row) => row.occupant?.deliveryId === current)
          || unit.borrowedRows.some((row) => row.occupant.deliveryId === current));
        return stillShown ? current : null;
      });
    };
    const onCalled = (data: { id: string }) => {
      setHighlightId(data.id);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 14_000);
    };
    socket.on('waiting_board_updated', onBoard);
    socket.on('delivery_called', onCalled);
    // Re-sync after a reconnect: events emitted while offline are lost.
    socket.on('connect', fetchBoard);
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      socket.off('waiting_board_updated', onBoard);
      socket.off('delivery_called', onCalled);
      socket.off('connect', fetchBoard);
    };
  }, [socket, fetchBoard]);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  const unitKeys = useMemo(() => {
    const fromBrand = Object.keys(brand?.units ?? {});
    if (fromBrand.length > 0) return fromBrand;
    return board?.units.map((unit) => unit.unit) ?? [];
  }, [brand, board]);
  const boardByUnit = useMemo(
    () => new Map<UnitKey, WaitingBoardUnit>(board?.units.map((unit) => [unit.unit, unit]) ?? []),
    [board],
  );

  useEffect(() => {
    if (unitKeys.length === 0) return;
    if (!activeTab || !unitKeys.includes(activeTab)) setActiveTab(unitKeys[0]);
  }, [activeTab, unitKeys]);

  const mallName  = brand?.mall.mallName ?? 'THISO GROUP';
  const tagline   = brand?.mall.tagline  ?? 'Hệ thống điều phối giao-nhận hàng thông minh';
  const mallLogo  = brand?.mall.logoUrl  ?? null;
  const driverUrl = `${window.location.origin}/register`;

  const allUnits = board?.units ?? [];
  const totalWaiting   = allUnits.reduce((sum, unit) => sum + Object.values(unit.waitingTotal).reduce((a, b) => a + (b ?? 0), 0), 0);
  const totalCalled    = allUnits.reduce((sum, unit) => sum + unit.slotRows.filter((row) => row.state === 'CALLED').length
    + unit.borrowedRows.filter((row) => row.occupant.status === 'CALLED').length, 0);
  const totalReceiving = allUnits.reduce((sum, unit) => sum + unit.slotRows.filter((row) => row.state === 'RECEIVING').length
    + unit.borrowedRows.filter((row) => row.occupant.status !== 'CALLED').length, 0);

  const desktopGridStyle = {
    gridTemplateColumns: `repeat(${Math.min(Math.max(unitKeys.length, 1), 3)}, minmax(0, 1fr))`,
  };

  return {
    board,
    boardByUnit,
    highlightId,
    now,
    isFullscreen,
    brand,
    isMobile,
    activeTab,
    setActiveTab,
    view,
    toggleView,
    toggleFullscreen,
    unitKeys,
    desktopGridStyle,
    mallName,
    tagline,
    mallLogo,
    driverUrl,
    totalWaiting,
    totalCalled,
    totalReceiving,
  };
}
