import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Badge, Carousel, Empty, Tabs, type CarouselRef } from 'antd';
import { useWaitingScreen } from '../features/waiting-screen/hooks/useWaitingScreen';
import BrightUnitPanel from '../features/waiting-screen/components/bright/UnitPanel';
import { getDeliveryUnitKey, getUnitBrand } from '../features/waiting-screen/utils';

const DESKTOP_WAITING_SCREEN_QUERY = '(min-width: 1025px)';
const ROTATION_INTERVAL_MS = 60_000;

function useDesktopWaitingScreen() {
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(DESKTOP_WAITING_SCREEN_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_WAITING_SCREEN_QUERY);
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return desktop;
}

export default function WaitingScreen() {
  const hook = useWaitingScreen();
  const desktop = useDesktopWaitingScreen();
  const { deliveries, highlightId, brand, activeTab, setActiveTab, unitKeys } = hook;
  const carouselRef = useRef<CarouselRef>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(60);
  const unitKeySignature = unitKeys.join('|');
  const nextRotationAt = useRef(0);
  const resetCooldown = () => {
    nextRotationAt.current = performance.now() + ROTATION_INTERVAL_MS;
    setCooldownSeconds(60);
  };
  const initialSlide = useMemo(() => Math.max(0, unitKeys.indexOf(activeTab)), [activeTab, unitKeys]);
  const tabItems = useMemo(() => unitKeys.map((unit) => {
    const config = getUnitBrand(brand, unit);
    const called = deliveries.filter((delivery) => getDeliveryUnitKey(delivery) === unit && delivery.status === 'CALLED').length;
    return {
      key: unit,
      label: (
        <span className="inline-flex items-center gap-1">
          <Avatar size="small" src={config.logoUrl ?? undefined}>{config.logoUrl ? undefined : config.icon}</Avatar>
          {config.shortName}
          {called > 0 && <Badge status="processing" />}
        </span>
      ),
    };
  }), [brand, deliveries, unitKeys]);

  useEffect(() => {
    if (!desktop || unitKeys.length < 2) return undefined;
    resetCooldown();
    const interval = window.setInterval(() => {
      const remaining = nextRotationAt.current - performance.now();
      if (remaining <= 0) {
        resetCooldown();
        carouselRef.current?.next();
      } else {
        setCooldownSeconds(Math.ceil(remaining / 1000));
      }
    }, 250);
    return () => window.clearInterval(interval);
  }, [desktop, unitKeys.length, unitKeySignature]);

  useEffect(() => {
    const activeTabElement = tabsRef.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    activeTabElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  if (!unitKeys.length) {
    return (
      <main className="grid min-h-[calc(100dvh-60px)] place-items-center p-4">
        <Empty description="Chưa có xe chờ trong khu vực này" />
      </main>
    );
  }

  return (
    <main className="waiting-screen-viewport relative flex min-h-[calc(100dvh-60px)] flex-col overflow-y-auto px-3 py-3 min-[1025px]:h-[calc(100dvh-60px)] min-[1025px]:min-h-0 min-[1025px]:overflow-hidden sm:px-5">
      <div
        ref={tabsRef}
        className="waiting-unit-tabs"
        onFocusCapture={(event) => {
          const tab = event.target instanceof HTMLElement && event.target.getAttribute('role') === 'tab' ? event.target : null;
          if (tab) {
            window.requestAnimationFrame(() => tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }));
          }
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            const index = unitKeys.indexOf(key);
            if (index >= 0) {
              resetCooldown();
              carouselRef.current?.goTo(index);
            }
          }}
          items={tabItems}
          centered
          size="large"
        />
      </div>
      <Carousel
        ref={carouselRef}
        key={unitKeySignature}
        className="waiting-unit-carousel min-[1025px]:min-h-0 min-[1025px]:flex-1"
        arrows={desktop && unitKeys.length > 1}
        autoplay={false}
        waitForAnimate={false}
        draggable={!desktop}
        swipe={!desktop}
        touchMove={!desktop}
        dots={desktop && unitKeys.length > 1}
        initialSlide={initialSlide}
        beforeChange={(_current, index) => {
          resetCooldown();
          setActiveTab(unitKeys[index] ?? unitKeys[0]);
        }}
      >
        {unitKeys.map((unit) => (
          <div key={unit} className={desktop ? 'h-full pb-7' : 'pb-7'}>
            <BrightUnitPanel
              unitKey={unit}
              deliveries={deliveries.filter((delivery) => getDeliveryUnitKey(delivery) === unit)}
              highlightId={highlightId}
              brand={brand}
              desktop={desktop}
              cooldownSeconds={desktop && unitKeys.length > 1 ? cooldownSeconds : null}
            />
          </div>
        ))}
      </Carousel>
    </main>
  );
}
