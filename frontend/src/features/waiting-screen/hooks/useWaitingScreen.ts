import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRealtimeScope, useSocket } from '../../../context/SocketContext';
import api from '../../../lib/api';
import type { DeliveryRegistration } from '../../../lib/types';
import { getDeliveryUnitKey, normalizeWaitingScreenDeliveries } from '../utils';
import type { BrandConfig, UnitKey } from '../types';

export function useWaitingScreen() {
  const socket        = useSocket();
  const realtimeScope = useRealtimeScope();

  const [deliveries, setDeliveries]   = useState<DeliveryRegistration[]>([]);
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
    setDeliveries([]);
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

  const fetchQueue = useCallback(async () => {
    if (!realtimeScope.businessLocationId && !realtimeScope.unitConfigId) return;
    try {
      const response = await api.get<DeliveryRegistration[]>('/api/deliveries/queue', { params: realtimeScope });
      setDeliveries(normalizeWaitingScreenDeliveries(response.data));
    } catch { /* silent */ }
  }, [realtimeScope]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  useEffect(() => {
    socket.on('queue_updated', (data: DeliveryRegistration[]) => {
      const normalized = normalizeWaitingScreenDeliveries(data);
      setDeliveries(normalized);
      setHighlightId((current) => {
        if (!current) return current;
        return normalized.some((item) => item.id === current) ? current : null;
      });
    });
    socket.on('delivery_called', (data: { id: string }) => {
      setHighlightId(data.id);
      fetchQueue();
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => setHighlightId(null), 14_000);
    });
    socket.on('delivery_completed', fetchQueue);
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
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

  const mallName  = brand?.mall.mallName ?? 'THISO GROUP';
  const tagline   = brand?.mall.tagline  ?? 'Hệ thống điều phối giao-nhận hàng thông minh';
  const mallLogo  = brand?.mall.logoUrl  ?? null;
  const driverUrl = `${window.location.origin}/register`;

  const totalWaiting   = deliveries.filter((d) => d.status === 'WAITING').length;
  const totalCalled    = deliveries.filter((d) => d.status === 'CALLED').length;
  const totalReceiving = 0;

  const desktopGridStyle = {
    gridTemplateColumns: `repeat(${Math.min(Math.max(unitKeys.length, 1), 3)}, minmax(0, 1fr))`,
  };

  return {
    deliveries,
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
