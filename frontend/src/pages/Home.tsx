import { Button, Typography } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import BusinessLocationSelectorModal from '../components/BusinessLocationSelectorModal';
import { useAuth } from '../context/AuthContext';
import { usePublicBusinessLocation } from '../context/PublicBusinessLocationContext';
import { canSelectPublicLocation } from '../lib/publicLocationAccess';

export default function Home() {
  const { isLoading: authLoading, isAuthenticated, user } = useAuth();
  const { selectedBusinessLocationId, locations, isLoading, error, selectPublicBusinessLocation } = usePublicBusinessLocation();
  const [dismissed, setDismissed] = useState(false);
  const canSelect = canSelectPublicLocation(authLoading, isAuthenticated, user?.role);

  return (
    <>
    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <Typography.Title level={1} className="!mb-0 !text-3xl sm:!text-4xl">
          Hệ thống điều phối nhận hàng THISO
        </Typography.Title>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link to="/register" className="mb-2"><Button color="primary" variant="solid" size="large" block style={{ height: '80px', fontSize: '24px' }}>Đăng ký giao hàng</Button></Link>
          <Link to="/track" className="mb-2"><Button color="pink" variant="solid" size="large" block style={{ height: '80px', fontSize: '24px' }}>Theo dõi chuyến giao hàng</Button></Link>
          <Link to="/waiting-screen"><Button color="purple" variant="solid" size="large" block style={{ height: '80px', fontSize: '24px' }}>Màn hình gọi số</Button></Link>
        </div>
      </div>
    </main>
    <BusinessLocationSelectorModal
      open={canSelect && !selectedBusinessLocationId && !dismissed}
      title="Chọn khu vực"
      description="Chọn khu vực giao hàng để hiển thị thông tin phù hợp."
      locations={locations}
      currentId={selectedBusinessLocationId}
      loading={isLoading}
      error={error}
      onSelect={selectPublicBusinessLocation}
      onClose={() => setDismissed(true)}
    />
    </>
  );
}
