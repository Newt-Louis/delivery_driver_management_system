import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Form, Grid, Input, Layout, Row, Space, Typography } from 'antd';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import api from '../lib/api';
import { getOrCreateDeviceId } from '../lib/authCookies';

interface LoginValues {
  email: string;
  password: string;
}

function homePathForRole(role?: string) {
  return role === 'CHECKIN' ? '/check-in' : '/dashboard';
}

export default function Login() {
  const { login, isAuthenticated, isLoading, user } = useAuth();
  const { mall } = useBranding();
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginValues>();
  const [error, setError] = useState('');
  const [hasActiveSessionConflict, setHasActiveSessionConflict] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const screens = Grid.useBreakpoint();

  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to={homePathForRole(user?.role)} replace />;

  async function submitLogin(values: LoginValues, force = false) {
    setError('');
    setHasActiveSessionConflict(false);
    setSubmitting(true);

    try {
      const res = await api.post('/api/auth/login', {
        email: values.email,
        password: values.password,
        deviceId: getOrCreateDeviceId(),
        deviceName: navigator.userAgent,
        force,
      });

      if (!res.data?.token) {
        setError('Tài khoản cần bước xác thực bổ sung chưa được hỗ trợ trên giao diện này.');
        return;
      }

      login(res.data.token, res.data.user, res.data.session?.expiresInSeconds ?? res.data.expiresInSeconds);
      navigate(homePathForRole(res.data.user?.role));
    } catch (err: any) {
      if (err.response?.status === 409 && err.response?.data?.error === 'ActiveSessionExists') {
        setHasActiveSessionConflict(true);
        setError(err.response.data.message ?? 'Tài khoản này đang đăng nhập ở thiết bị khác.');
      } else {
        setError('Email hoặc mật khẩu không đúng.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const locationName = mall.locationName || mall.mallName;

  return (
    <Layout className="min-h-screen px-4 py-6 sm:px-6 lg:p-8">
      <Layout.Content className="m-auto w-full max-w-6xl">
        <Row align="middle" gutter={screens.lg ? 64 : 0}>
          {screens.lg && (
            <Col lg={13}>
              <Space direction="vertical" size={24} className="max-w-xl">
                <img
                  src="/thiso_logo-full-color.jpg"
                  alt="THISO"
                  className="h-16 w-auto object-contain"
                />
                <Typography.Title level={1} className="!mb-0">
                  Vận hành giao nhận, rõ ràng từng lượt
                </Typography.Title>
                <Typography.Paragraph type="secondary" className="!mb-0 !text-base">
                  Đăng nhập để điều phối, check-in và nhận hàng trong cùng một không gian làm việc.
                </Typography.Paragraph>
              </Space>
            </Col>
          )}

          <Col xs={24} lg={11}>
            <Card className="mx-auto w-full max-w-md" styles={{ body: { padding: screens.sm ? 32 : 24 } }}>
              <Space direction="vertical" size={24} className="w-full">
                <Space direction="vertical" size={12} className="w-full">
                  {!screens.lg && (
                    <div className="w-full">
                      <img
                        src="/thiso_logo-full-color.jpg"
                        alt="THISO"
                        className="block h-auto w-full object-contain"
                      />
                    </div>
                  )}
                  <div>
                    <Typography.Title level={2} className="!mb-1">
                      Đăng nhập
                    </Typography.Title>
                    <Typography.Text type="secondary">
                      {locationName}
                    </Typography.Text>
                  </div>
                </Space>

                {error && (
                  <Alert
                    type="error"
                    showIcon
                    message={error}
                    action={hasActiveSessionConflict ? (
                      <Space wrap size={8}>
                        <Button
                          danger
                          size="small"
                          loading={submitting}
                          onClick={() => void submitLogin(form.getFieldsValue(), true)}
                        >
                          Đăng nhập tại đây
                        </Button>
                        <Button
                          size="small"
                          disabled={submitting}
                          onClick={() => {
                            setHasActiveSessionConflict(false);
                            setError('');
                          }}
                        >
                          Hủy
                        </Button>
                      </Space>
                    ) : undefined}
                  />
                )}

                <Form<LoginValues>
                  form={form}
                  layout="vertical"
                  requiredMark={false}
                  onFinish={(values) => void submitLogin(values)}
                  onValuesChange={() => {
                    if (error) setError('');
                    if (hasActiveSessionConflict) setHasActiveSessionConflict(false);
                  }}
                >
                  <Form.Item
                    label="Email"
                    name="email"
                    rules={[
                      { required: true, message: 'Nhập email để tiếp tục.' },
                      { type: 'email', message: 'Nhập đúng định dạng email.' },
                    ]}
                  >
                    <Input
                      autoComplete="email"
                      inputMode="email"
                      prefix={<MailOutlined />}
                      placeholder="name@company.com"
                    />
                  </Form.Item>
                  <Form.Item
                    label="Mật khẩu"
                    name="password"
                    rules={[{ required: true, message: 'Nhập mật khẩu để tiếp tục.' }]}
                  >
                    <Input.Password
                      autoComplete="current-password"
                      prefix={<LockOutlined />}
                      placeholder="Nhập mật khẩu"
                    />
                  </Form.Item>
                  <Form.Item className="!mb-0 !mt-8">
                    <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
                      Đăng nhập
                    </Button>
                  </Form.Item>
                </Form>
              </Space>
            </Card>
          </Col>
        </Row>
      </Layout.Content>
    </Layout>
  );
}
