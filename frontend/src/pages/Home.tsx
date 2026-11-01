import { useEffect, useRef, useState } from 'react';
import { Button, Grid, Tour, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { useHomeTour } from '../context/HomeTourContext';
import { useDriverNotifications } from '../features/driver-notifications/DriverNotificationsProvider';

export default function Home() {
  const { guideReady } = useDriverNotifications();
  const screens = Grid.useBreakpoint();
  const { selectorOpen, selectionCount } = useHomeTour();
  const initialSelectionCount = useRef(selectionCount);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [closed, setClosed] = useState(false);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (selectionCount > initialSelectionCount.current) setCurrent(1);
  }, [selectionCount]);

  return (
    <>
    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <Typography.Title level={1} className="!mb-0 !text-3xl sm:!text-4xl">
          Hệ thống điều phối nhận hàng THISO
        </Typography.Title>
        <div ref={actionsRef} className="flex w-full max-w-sm flex-col gap-3">
          <Link to="/register" className="mb-2"><Button color="primary" variant="outlined" size="large" block>Đăng ký giao hàng</Button></Link>
          <Typography.Title className="!text-sm !text-gray-500" level={2}>
            Hoặc
          </Typography.Title>
          <Link to="/track"><Button color="cyan" variant="outlined" size="large" block>Theo dõi chuyến giao hàng</Button></Link>
        </div>
      </div>
    </main>
    <Tour open={guideReady && !selectorOpen && !closed} current={current} onClose={() => setClosed(true)}
      actionsRender={(_, info) => info.current === 0 ? null : <Button type="primary" onClick={() => setClosed(true)}>Đã hiểu</Button>}
      steps={[
        { title: 'Chọn khu vực giao hàng', description: 'Bấm nút này và chọn khu vực bạn sẽ giao hàng.', target: () => document.querySelector<HTMLElement>('.public-location-button')!, placement: screens.lg ? 'left' : 'top' },
        { title: 'Chọn thao tác', description: 'Chọn Đăng ký giao hàng hoặc Theo dõi chuyến giao hàng để tiếp tục.', target: () => actionsRef.current!, placement: 'bottom' },
      ]} />
    </>
  );
}
