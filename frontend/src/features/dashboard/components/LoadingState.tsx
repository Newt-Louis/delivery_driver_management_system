import { Spin } from 'antd';
export default function LoadingState() {
  return <div className="py-20 text-center"><Spin tip="Đang tải dữ liệu điều phối"><div style={{ minHeight: 60 }} /></Spin></div>;
}
