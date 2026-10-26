import { SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Form, Input, Typography, theme, type InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../../lib/api';
import { looksLikeCode } from '../utils';

export default function TrackLookup() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const [input, setInput]       = useState('');
  const [error, setError]       = useState('');
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit() {
    const val = input.trim().toUpperCase();
    if (!val) return;
    setError('');
    setChecking(true);
    try {
      if (looksLikeCode(val)) {
        await api.get(`/api/track/${val}`);
        navigate(`/track/${val}`);
      } else {
        const res = await api.get<{ registrationCode: string }>('/api/track/search', { params: { plate: val } });
        navigate(`/track/${res.data.registrationCode}`);
      }
    } catch {
      setError('Không tìm thấy. Kiểm tra lại mã đăng ký hoặc biển số xe.');
      setChecking(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-lg items-center px-4 py-8 sm:px-6">
      <Card className="w-full" styles={{ body: { padding: 'clamp(20px, 5vw, 32px)' } }}>
        <div className="text-center">
          <Typography.Title level={2} className="!mb-1 !text-2xl">Theo dõi giao hàng</Typography.Title>
          <Typography.Text type="secondary">Nhập mã đăng ký hoặc biển số xe để xem hành trình.</Typography.Text>
        </div>

        <Form className="mt-7" layout="vertical" onFinish={handleSubmit} requiredMark={false}>
          <Form.Item label="Mã đăng ký hoặc biển số xe" className="!mb-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value.toUpperCase()); setError(''); }}
            placeholder="VD: PVTABCD261026001 hoặc 51C-123.45"
            size="large"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="font-mono"
          />
          </Form.Item>
          {error && <Alert className="mb-3" type="error" showIcon message={error} />}
          <Button htmlType="submit" type="primary" size="large" block icon={<SearchOutlined />} loading={checking} disabled={!input.trim()}>Xem trạng thái</Button>
        </Form>
        <div className="mt-6 flex flex-wrap justify-center gap-x-8 gap-y-3 text-center text-base">
          <Typography.Text type="secondary">Chưa đăng ký? <Link to="/register" className="font-semibold underline underline-offset-4" style={{ color: token.colorPrimary }}>Đăng ký ngay</Link></Typography.Text>
          <Typography.Text type="secondary">Nhập sai thông tin? <Link to="/cancelled" className="font-semibold underline underline-offset-4" style={{ color: token.colorError }}>Hủy chuyến</Link></Typography.Text>
        </div>
      </Card>
    </main>
  );
}
