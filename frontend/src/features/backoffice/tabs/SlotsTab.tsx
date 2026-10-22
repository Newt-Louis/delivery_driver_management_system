import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppstoreAddOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Empty, Flex, Popconfirm, Result, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import api from '../../../lib/api';
import type { GoodsType, Slot, UnitConfig, Zone } from '../../../lib/types';
import { GOODS_LABELS, STATUS_LABEL, VEHICLE_LABEL } from '../constants';
import SlotModal from '../components/SlotModal';

function slotUnitLabel(slot: Slot) {
  const unit = slot.zone?.unitConfig;
  return unit?.displayName || unit?.shortName || unit?.unit || slot.assignedUnit;
}

const NORMAL_GOODS: GoodsType[] = ['FRESH_FOOD', 'GENERAL_GOODS', 'THI_CONG'];

const SLOT_STATUS_COLOR: Record<Slot['status'], 'success' | 'processing' | 'warning'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'processing',
  RESERVED: 'warning',
  MAINTENANCE: 'warning',
};

function slotGoodsPriority(slot: Slot): GoodsType[] {
  if (slot.autoWarehouseOnly) return [];
  const acceptedGoods = slot.acceptedGoods.filter((goodsType) => NORMAL_GOODS.includes(goodsType));
  const priority = slot.goodsPriority.filter((goodsType) => NORMAL_GOODS.includes(goodsType));
  if (priority.length > 0) {
    return [
      ...priority,
      ...acceptedGoods.filter((goodsType) => !priority.includes(goodsType)),
    ];
  }
  return acceptedGoods.length > 0 ? acceptedGoods : NORMAL_GOODS;
}

export default function SlotsTab() {
  const queryClient = useQueryClient();
  const [editSlot, setEditSlot] = useState<Slot | null | undefined>(undefined);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unitFilter, setUnitFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const { data: slots = [], isLoading, isError, refetch } = useQuery<Slot[]>({
    queryKey: ['slots', 'all'],
    queryFn: async () => (await api.get('/api/slots/all')).data,
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/api/zones')).data,
  });
  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['slots'] });
    queryClient.invalidateQueries({ queryKey: ['slots', 'all'] });
  }

  async function toggleActive(slot: Slot) {
    try {
      await api.patch(`/api/slots/${slot.id}`, { isActive: !slot.isActive });
      refresh();
    } catch {
      setNotice({ type: 'error', message: 'Không thể cập nhật trạng thái kích hoạt của slot.' });
    }
  }

  async function confirmDelete(slot: Slot) {
    try {
      const res = await api.delete(`/api/slots/${slot.id}`);
      setNotice({ type: 'success', message: res.data.message ?? (res.data.deleted ? 'Đã xóa slot.' : 'Đã vô hiệu hóa slot.') });
      refresh();
    } catch {
      setNotice({ type: 'error', message: 'Lỗi xóa slot.' });
    }
  }

  const filtered = slots.filter((slot) => {
    if (!showInactive && !slot.isActive) return false;
    if (unitFilter && slot.zone?.unitConfig?.id !== unitFilter) return false;
    if (typeFilter && slot.vehicleType !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: slots.length,
    active: slots.filter((slot) => slot.isActive).length,
    trucks: slots.filter((slot) => slot.vehicleType === 'TRUCK' && slot.isActive).length,
    motorbikes: slots.filter((slot) => slot.vehicleType === 'MOTORBIKE' && slot.isActive).length,
    available: slots.filter((slot) => slot.isActive && slot.status === 'AVAILABLE').length,
    occupied: slots.filter((slot) => slot.isActive && slot.status === 'OCCUPIED').length,
  };

  const columns: TableColumnsType<Slot> = [
    {
      title: 'Tên slot',
      key: 'slot',
      fixed: 'left',
      width: 180,
      render: (_, slot) => (
        <Space size={8} align="center" className="flex w-full">
          <Typography.Text strong code className="shrink-0">{slot.code}</Typography.Text>
          <Tooltip title={slot.name}>
            <span className="min-w-0 flex-1">
              <Typography.Text ellipsis>{slot.name}</Typography.Text>
            </span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Khu / đơn vị',
      key: 'scope',
      width: 200,
      render: (_, slot) => (
        <Space direction="vertical" size={4}>
          {slot.zone ? <Tag>{slot.zone.code}</Tag> : <Typography.Text type="secondary">—</Typography.Text>}
          <Tooltip title={slotUnitLabel(slot)}><Typography.Text type="secondary" ellipsis className="max-w-40">{slotUnitLabel(slot)}</Typography.Text></Tooltip>
        </Space>
      ),
    },
    {
      title: 'Loại xe',
      dataIndex: 'vehicleType',
      width: 130,
      render: (vehicleType: Slot['vehicleType']) => VEHICLE_LABEL[vehicleType] ?? vehicleType,
    },
    {
      title: 'Hàng nhận',
      key: 'goods',
      width: 280,
      render: (_, slot) => (
        <Space size={[4, 4]} wrap>
          {slot.autoWarehouseOnly && <Tag>🏭 Kho tự động</Tag>}
          {!slot.autoWarehouseOnly && slotGoodsPriority(slot).map((goodsType, index) => (
            <Tag key={goodsType}>{index + 1}. {GOODS_LABELS[goodsType]}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: 'Sức chứa',
      dataIndex: 'maxCapacity',
      align: 'center',
      width: 110,
      render: (capacity: number | null | undefined) => capacity ?? 1,
    },
    {
      title: 'Tự động',
      dataIndex: 'autoAssign',
      width: 110,
      render: (autoAssign: boolean) => <Tag color={autoAssign ? 'success' : 'default'}>{autoAssign ? 'Bật' : 'Tắt'}</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      width: 130,
      render: (status: Slot['status']) => <Tag color={SLOT_STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>,
    },
    {
      title: 'Kích hoạt',
      dataIndex: 'isActive',
      width: 125,
      render: (_: boolean, slot) => (
        <Switch
          checked={slot.isActive}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          aria-label={`${slot.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'} slot ${slot.code}`}
          onChange={() => toggleActive(slot)}
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      fixed: 'right',
      align: 'right',
      width: 120,
      render: (_, slot) => (
        <Space size="small">
          <Tooltip title="Chỉnh sửa slot">
            <Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Chỉnh sửa slot ${slot.code}`} onClick={() => setEditSlot(slot)} />
          </Tooltip>
          <Popconfirm
            title={`Xóa slot ${slot.code}?`}
            description="Nếu slot đã có lịch sử sử dụng, hệ thống sẽ vô hiệu hóa thay vì xóa hoàn toàn."
            okText="Xóa / vô hiệu"
            cancelText="Hủy"
            okButtonProps={{ color: 'danger', variant: 'solid' }}
            onConfirm={() => confirmDelete(slot)}
          >
            <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} aria-label={`Xóa slot ${slot.code}`} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Flex justify="end">
        <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => setEditSlot(null)}>Thêm slot mới</Button>
      </Flex>

      {editSlot !== undefined && (
        <SlotModal slot={editSlot} zones={zones} onClose={() => setEditSlot(undefined)} onSaved={() => { setEditSlot(undefined); refresh(); }} />
      )}

      {notice && <Alert type={notice.type} message={notice.message} showIcon closable onClose={() => setNotice(null)} />}

      <Row gutter={[12, 12]}>
        {[
          { label: 'Tổng slot', value: stats.total },
          { label: 'Đang hoạt động', value: stats.active, tag: 'success' as const },
          { label: 'Xe tải', value: stats.trucks },
          { label: 'Xe máy', value: stats.motorbikes },
          { label: 'Trống', value: stats.available, tag: 'success' as const },
          { label: 'Đang dùng', value: stats.occupied, tag: 'processing' as const },
        ].map((stat) => (
          <Col key={stat.label} xs={12} sm={8} xl={4}>
            <Card size="small" className="h-full">
              <Statistic title={stat.label} value={stat.value} suffix={stat.tag && <Tag color={stat.tag}>{stat.tag === 'success' ? 'Sẵn sàng' : 'Đang xử lý'}</Tag>} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card size="small">
        <Flex wrap="wrap" gap="middle" align="center">
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">Đơn vị</Typography.Text>
            <Select
              className="min-w-52"
              value={unitFilter || undefined}
              placeholder="Tất cả đơn vị"
              allowClear
              onChange={(value) => setUnitFilter(value ?? '')}
              options={unitConfigs.map((unit) => ({ value: unit.id, label: `${unit.unit} - ${unit.displayName || unit.shortName || unit.unit}` }))}
            />
          </Space>
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">Loại xe</Typography.Text>
            <Select
              className="min-w-44"
              value={typeFilter || undefined}
              placeholder="Tất cả loại xe"
              allowClear
              onChange={(value) => setTypeFilter(value ?? '')}
              options={Object.entries(VEHICLE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Space>
          <Space align="center" className="pt-6">
            <Switch checked={showInactive} onChange={setShowInactive} aria-label="Hiện slot vô hiệu hóa" />
            <Typography.Text>Hiện slot vô hiệu hóa</Typography.Text>
          </Space>
          <Typography.Text type="secondary" className="sm:ml-auto">{filtered.length} slot</Typography.Text>
        </Flex>
      </Card>

      {isError ? (
        <Result
          status="error"
          title="Không thể tải danh sách slot"
          subTitle="Vui lòng kiểm tra kết nối rồi thử lại."
          extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Tải lại</Button>}
        />
      ) : (
        <Card bodyStyle={{ padding: 0 }}>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={filtered}
            loading={isLoading}
            locale={{ emptyText: <Empty description="Không có slot nào" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            pagination={{
              position: ['bottomCenter'],
              size: 'small',
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50],
              showTotal: (total) => `${total} slot`,
            }}
            scroll={{ x: 1435 }}
            rowClassName={(slot) => !slot.isActive ? 'opacity-60' : ''}
          />
        </Card>
      )}

      <Typography.Text type="secondary">
        * Slot có lịch sử giao hàng sẽ bị vô hiệu hóa thay vì xóa hoàn toàn để giữ dữ liệu lịch sử.
      </Typography.Text>
    </Space>
  );
}
