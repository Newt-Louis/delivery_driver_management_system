import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRealtimeScope, useSocket } from '../../../context/SocketContext';
import api from '../../../lib/api';
import type { BusinessLocation, DeliveryRegistration } from '../../../lib/types';
import { playChime } from '../../../lib/chime';
import { formatTicketForDelivery, getDeliveryUnitKey } from '../utils';
import type { BrandConfig, CalledAlert, UnitKey } from '../types';

function enrichCalledAlert(alert: CalledAlert, queue: DeliveryRegistration[]): CalledAlert {
  const delivery = queue.find((item) => item.id === alert.id);
  if (!delivery) return alert;

  const assignedSlot = delivery.assignedSlot;
  return {
    ...alert,
    delivery,
    vehiclePlate: delivery.vehiclePlate || alert.vehiclePlate,
    receivingUnit: delivery.assignedSlot?.zone?.unitConfig?.unit ?? delivery.unitConfig?.unit ?? delivery.receivingUnit ?? alert.receivingUnit,
    slotCode: assignedSlot?.code ?? alert.slotCode,
    slotName: assignedSlot?.name ?? alert.slotName,
    callCount: delivery.callCount ?? alert.callCount,
    ticketCode: formatTicketForDelivery(delivery) ?? alert.ticketCode,
  };
}

export function useWaitingScreen() {
  const socket        = useSocket();
  const realtimeScope = useRealtimeScope();
  const location      = useLocation();
  const navigate      = useNavigate();

  const [deliveries, setDeliveries]   = useState<DeliveryRegistration[]>([]);
  const [calledEvt, setCalledEvt]     = useState<CalledAlert | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [now, setNow]                 = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brand, setBrand]             = useState<BrandConfig | null>(null);
  const [locations, setLocations]     = useState<BusinessLocation[]>([]);
  const [isMobile, setIsMobile]       = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [activeTab, setActiveTab]     = useState<UnitKey>('');
  const [view, setView]               = useState<'dark' | 'bright'>(
    () => (localStorage.getItem('ws_view') as 'dark' | 'bright') ?? 'bright',
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deliveriesRef = useRef<DeliveryRegistration[]>([]);

  useEffect(() => {
    deliveriesRef.current = deliveries;
  }, [deliveries]);

  useEffect(() => { localStorage.setItem('ws_view', view); }, [view]);
  const toggleView = () => setView((v) => (v === 'dark' ? 'bright' : 'dark'));

  useEffect(() => {
    api.get<BrandConfig>('/api/brand', { params: realtimeScope }).then((r) => setBrand(r.data)).catch(() => {});
  }, [realtimeScope]);

  useEffect(() => {
    api.get<BusinessLocation[]>('/api/units/public/business-locations')
      .then((r) => setLocations(r.data))
      .catch(() => setLocations([]));
  }, []);

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
    socket.on('queue_updated', (data: DeliveryRegistration[]) => {
      setDeliveries(data);
      setCalledEvt((current) => current ? enrichCalledAlert(current, data) : current);
    });
    socket.on('delivery_called', (data: CalledAlert & { id: string }) => {
      playChime();
      setCalledEvt(enrichCalledAlert(data, deliveriesRef.current));
      setHighlightId(data.id);
      fetchQueue();
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

  function changeBusinessLocation(businessLocationId: string) {
    if (!businessLocationId || businessLocationId === realtimeScope.businessLocationId) return;
    const params = new URLSearchParams(location.search);
    params.set('businessLocationId', businessLocationId);
    params.delete('locationId');
    params.delete('unitConfigId');
    setDeliveries([]);
    setCalledEvt(null);
    setHighlightId(null);
    setActiveTab('');
    setBrand(null);
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
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
    locations,
    selectedBusinessLocationId: realtimeScope.businessLocationId ?? brand?.mall.id ?? '',
    changeBusinessLocation,
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
