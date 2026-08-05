import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRealtimeScope, useSocket } from '../../../context/SocketContext';
import api from '../../../lib/api';
import type { DeliveryRegistration } from '../../../lib/types';
import { playChime } from '../../../lib/chime';
import { getDeliveryUnitKey } from '../utils';
import type { BrandConfig, CalledAlert, UnitKey } from '../types';

export function useWaitingScreen() {
  const socket        = useSocket();
  const realtimeScope = useRealtimeScope();

  const [deliveries, setDeliveries]   = useState<DeliveryRegistration[]>([]);
  const [calledEvt, setCalledEvt]     = useState<CalledAlert | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now, setNow]                 = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brand, setBrand]             = useState<BrandConfig | null>(null);
  const [isMobile, setIsMobile]       = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [activeTab, setActiveTab]     = useState<UnitKey>('');
  const [view, setView]               = useState<'dark' | 'bright'>(
    () => (localStorage.getItem('ws_view') as 'dark' | 'bright') ?? 'bright',
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { localStorage.setItem('ws_view', view); }, [view]);
  const toggleView = () => setView((v) => (v === 'dark' ? 'bright' : 'dark'));

  useEffect(() => {
    api.get<BrandConfig>('/api/brand', { params: realtimeScope }).then((r) => setBrand(r.data)).catch(() => {});
  }, [realtimeScope]);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!realtimeScope.businessLocationId && !realtimeScope.unitConfigId) return;
    try {
      setDeliveries((await api.get('/api/deliveries/queue', { params: realtimeScope })).data);
    } catch { /* silent */ }
  }, [realtimeScope]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    socket.on('queue_updated', (data: DeliveryRegistration[]) => setDeliveries(data));
    socket.on('delivery_called', (data: CalledAlert & { id: string }) => {
      playChime();
      setCalledEvt(data);
      setHighlightId(data.id);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setCalledEvt(null); setHighlightId(null); }, 14000);
    });
    socket.on('delivery_completed', fetchQueue);
    return () => {
      socket.off('queue_updated');
      socket.off('delivery_called');
      socket.off('delivery_completed');
    };
  }, [socket, fetchQueue]);

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
    return [...new Set(deliveries.map(getDeliveryUnitKey).filter(Boolean))];
  }, [brand, deliveries]);

  useEffect(() => {
    if (unitKeys.length === 0) return;
    if (!activeTab || !unitKeys.includes(activeTab)) setActiveTab(unitKeys[0]);
  }, [activeTab, unitKeys]);

  const dismissAlert = () => { setCalledEvt(null); setHighlightId(null); };

  const mallName  = brand?.mall.mallName ?? 'THISO GROUP';
  const tagline   = brand?.mall.tagline  ?? 'Hệ thống điều phối giao-nhận hàng thông minh';
  const mallLogo  = brand?.mall.logoUrl  ?? null;
  const driverUrl = `${window.location.origin}/register`;

  const totalWaiting   = deliveries.filter((d) => d.status === 'WAITING').length;
  const totalCalled    = deliveries.filter((d) => d.status === 'CALLED').length;
  const totalReceiving = deliveries.filter((d) => ['RECEIVING', 'AUTO_WAREHOUSE_RECEIVING'].includes(d.status)).length;

  const desktopGridStyle = {
    gridTemplateColumns: `repeat(${Math.min(Math.max(unitKeys.length, 1), 3)}, minmax(0, 1fr))`,
  };

  return {
    deliveries,
    calledEvt,
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
    dismissAlert,
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
