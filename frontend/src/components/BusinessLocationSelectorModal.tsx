import { CheckCircleOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { Alert, Avatar, Card, Col, Empty, Flex, Modal, Row, Skeleton, Space, Tag, Typography, theme } from 'antd';
import type { BusinessLocation } from '../lib/types';

interface BusinessLocationSelectorModalProps {
  open: boolean;
  title?: string;
  description?: string;
  locations: BusinessLocation[];
  currentId?: string | null;
  loading?: boolean;
  saving?: boolean;
  required?: boolean;
  error?: string | null;
  onSelect: (businessLocationId: string) => void;
  onClose?: () => void;
}

export default function BusinessLocationSelectorModal({
  open,
  title = 'Chọn khu vực vận hành',
  description = 'Chọn một BusinessLocation để bắt đầu làm việc trong phạm vi dữ liệu của khu vực đó.',
  locations,
  currentId,
  loading = false,
  saving = false,
  required = false,
  error,
  onSelect,
  onClose,
}: BusinessLocationSelectorModalProps) {
  const { token } = theme.useToken();

  return (
    <Modal
      open={open}
      centered
      title={title}
      footer={null}
      closable={!required}
      mask={{ closable: !required }}
      keyboard={!required}
      width="min(760px, calc(100vw - 32px))"
      styles={{ body: { maxHeight: 'calc(100dvh - 180px)', overflowY: 'auto' } }}
      onCancel={onClose}
    >
      <Space orientation="vertical" size="large" className="w-full">
        <Typography.Paragraph type="secondary" className="!mb-0">{description}</Typography.Paragraph>

        {loading ? (
          <Skeleton active avatar paragraph={{ rows: 3 }} />
        ) : locations.length === 0 ? (
          <Empty description="Chưa có BusinessLocation nào đang hoạt động." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Row gutter={[12, 12]}>
            {locations.map((location) => {
              const selected = currentId === location.id;
              const unitCount = location.unitConfigs?.length ?? 0;
              const selectLocation = () => {
                if (!saving) onSelect(location.id);
              };
              return (
                <Col key={location.id} xs={24} sm={12}>
                  <Card
                    hoverable={!saving}
                    className="h-full"
                    style={selected ? { borderColor: token.colorPrimary } : undefined}
                    role="button"
                    tabIndex={saving ? -1 : 0}
                    aria-disabled={saving}
                    aria-label={`Chọn khu vực ${location.locationName}`}
                    onClick={selectLocation}
                    onKeyDown={(event) => {
                      if (!saving && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        selectLocation();
                      }
                    }}
                  >
                    <Card.Meta
                      avatar={<Avatar shape="square" size={44} src={location.logoUrl || undefined} icon={<EnvironmentOutlined />}>{location.code.slice(0, 2).toUpperCase()}</Avatar>}
                      title={<Flex justify="space-between" gap="small"><Typography.Text strong ellipsis>{location.locationName}</Typography.Text>{selected && <Tag color="processing" icon={<CheckCircleOutlined />}>Đang chọn</Tag>}</Flex>}
                      description={<Space orientation="vertical" size={2}><Typography.Text code type="secondary">{location.code}</Typography.Text><Typography.Text type="secondary">{unitCount} đơn vị đang hoạt động</Typography.Text></Space>}
                    />
                  </Card>
                </Col>
              );
            })}
          </Row>
        )}

        {error && <Alert type="error" showIcon title={error} />}
      </Space>
    </Modal>
  );
}
