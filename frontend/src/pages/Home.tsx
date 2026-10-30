import { Button, Typography } from 'antd';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 text-center">
        <Typography.Title level={1} className="!mb-0 !text-3xl sm:!text-4xl">
          Hệ thống điều phối nhận hàng THISO
        </Typography.Title>
        <div className="flex w-full max-w-sm flex-col gap-3">
          <Link to="/register"><Button type="primary" size="large" block>Đăng ký giao hàng</Button></Link>
          <Link to="/track"><Button size="large" block>Theo dõi chuyến giao hàng</Button></Link>
        </div>
      </div>
    </main>
  );
}
