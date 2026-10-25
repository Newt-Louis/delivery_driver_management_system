import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AppstoreAddOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, AutoComplete, Button, Card, Col, Collapse, Descriptions, Empty, Flex, Grid, Input, Pagination, Popconfirm, Result, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip, Typography, type TableColumnsType } from 'antd';
import api from '../../../lib/api';
import type { GoodsType, Slot, UnitConfig, Zone } from '../../../lib/types';
import { GOODS_LABELS, STATUS_LABEL, VEHICLE_LABEL } from '../constants';
import SlotModal from '../components/SlotModal';
import ResponsiveDataToolbar, { SearchButton } from '../components/ResponsiveDataToolbar';

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
  const screens = Grid.useBreakpoint();
  const [editSlot, setEditSlot] = useState<Slot | null | undefined>(undefined);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [unitFilter, setUnitFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    if (nameSearch && !slot.name.toLocaleLowerCase('vi-VN').includes(nameSearch.toLocaleLowerCase('vi-VN'))) return false;
    return true;
  });
  const nameOptions = [...new Set(slots.map((slot) => slot.name.trim()).filter(Boolean))].map((name) => ({ value: name }));
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedSlots = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function submitNameSearch() {
    setNameSearch(searchDraft.trim());
    setPage(1);
  }

  function updatePagination(nextPage: number, nextPageSize = pageSize) {
    setPage(nextPage);
    setPageSize(nextPageSize);
  }

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
      title: 'Khu / đơn vị',
      key: 'scope',
      width: 120,
      render: (_, slot) => (
        <Space direction="vertical" size={4}>
          {slot.zone ? <Tag>{slot.zone.code}</Tag> : <Typography.Text type="secondary">—</Typography.Text>}
          <Typography.Text type="secondary" ellipsis className="max-w-40">{slotUnitLabel(slot)}</Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Tên slot',
      key: 'slot',
      fixed: 'left',
      width: 160,
      render: (_, slot) => (
        <Space size={8} align="center" className="flex w-full">
          <Typography.Text strong code className="shrink-0">{slot.code}</Typography.Text>
            <span className="min-w-0 flex-1">
              <Typography.Text ellipsis>{slot.name}</Typography.Text>
            </span>
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
      width: 300,
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
      width: 110,
      render: (status: Slot['status']) => <Tag color={SLOT_STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>,
    },
    {
      title: 'Kích hoạt',
      dataIndex: 'isActive',
      width: 80,
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

  function slotActions(slot: Slot) {
    return (
      <Space size="small" onClick={(event) => event.stopPropagation()}>
        <Switch
          checked={slot.isActive}
          checkedChildren="Bật"
          unCheckedChildren="Tắt"
          aria-label={`${slot.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'} slot ${slot.code}`}
          onChange={() => toggleActive(slot)}
        />
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
    );
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
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

      <ResponsiveDataToolbar
        filters={(
          <>
            <Space direction="vertical" size={4} className="w-full sm:w-auto">
              <Typography.Text type="secondary">Tìm tên slot</Typography.Text>
              <AutoComplete
                className="w-full sm:w-64"
                value={searchDraft}
                options={nameOptions}
                open={searchOpen && Boolean(searchDraft.trim())}
                notFoundContent="Không có dữ liệu"
                onFocus={() => setSearchOpen(Boolean(searchDraft.trim()))}
                onBlur={() => setSearchOpen(false)}
                onChange={(value) => { setSearchDraft(value); setSearchOpen(Boolean(value.trim())); }}
                onSelect={(value) => { setSearchDraft(value); setSearchOpen(false); }}
                filterOption={(inputValue, option) => String(option?.value ?? '').toLocaleLowerCase('vi-VN').includes(inputValue.toLocaleLowerCase('vi-VN'))}
              >
                <Input.Search allowClear placeholder="Nhập tên slot" enterButton={<SearchButton />} onSearch={submitNameSearch} />
              </AutoComplete>
            </Space>
          <Space direction="vertical" size={4}>
            <Typography.Text type="secondary">Đơn vị</Typography.Text>
            <Select
              className="min-w-52"
              value={unitFilter || undefined}
              placeholder="Tất cả đơn vị"
              allowClear
              onChange={(value) => { setUnitFilter(value ?? ''); setPage(1); }}
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
              onChange={(value) => { setTypeFilter(value ?? ''); setPage(1); }}
              options={Object.entries(VEHICLE_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Space>
          <Space align="center" className="pt-6">
            <Switch checked={showInactive} onChange={(checked) => { setShowInactive(checked); setPage(1); }} aria-label="Hiện slot vô hiệu hóa" />
            <Typography.Text>Hiện slot vô hiệu hóa</Typography.Text>
          </Space>
          </>
        )}
        createAction={<Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => setEditSlot(null)}>Thêm slot mới</Button>}
      />

      {isError ? (
        <Result
          status="error"
          title="Không thể tải danh sách slot"
          subTitle="Vui lòng kiểm tra kết nối rồi thử lại."
          extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Tải lại</Button>}
        />
      ) : isLoading ? (
        <Card size="small" loading />
      ) : screens.lg ? (
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
              current: currentPage,
              pageSize,
              onChange: updatePagination,
            }}
            scroll={{ x: 1435 }}
            rowClassName={(slot) => !slot.isActive ? 'opacity-60' : ''}
          />
        </Card>
      ) : pagedSlots.length === 0 ? (
        <Empty description="Không có slot nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Space direction="vertical" size="middle" className="w-full">
          <Collapse
            items={pagedSlots.map((slot) => ({
              key: slot.id,
              label: (
                <Space direction="vertical" size={0} className="min-w-0">
                  <Typography.Text type="secondary" ellipsis className="block max-w-44">{slot.zone?.code ?? 'Chưa gán khu'} · {slotUnitLabel(slot)}</Typography.Text>
                  <Space size="small" className="min-w-0">
                    <Typography.Text strong code>{slot.code}</Typography.Text>
                    <Typography.Text ellipsis className="max-w-36">{slot.name}</Typography.Text>
                  </Space>
                </Space>
              ),
              extra: slotActions(slot),
              children: (
                <Descriptions size="small" column={1} items={[
                  { key: 'scope', label: 'Khu / đơn vị', children: <Space size="small" wrap>{slot.zone && <Tag>{slot.zone.code}</Tag>}<Typography.Text>{slotUnitLabel(slot)}</Typography.Text></Space> },
                  { key: 'vehicle', label: 'Loại xe', children: VEHICLE_LABEL[slot.vehicleType] ?? slot.vehicleType },
                  { key: 'goods', label: 'Hàng nhận', children: slot.autoWarehouseOnly ? <Tag>🏭 Kho tự động</Tag> : <Space size={[4, 4]} wrap>{slotGoodsPriority(slot).map((goodsType, index) => <Tag key={goodsType}>{index + 1}. {GOODS_LABELS[goodsType]}</Tag>)}</Space> },
                  { key: 'capacity', label: 'Sức chứa', children: slot.maxCapacity ?? 1 },
                  { key: 'auto', label: 'Tự động', children: <Tag color={slot.autoAssign ? 'success' : 'default'}>{slot.autoAssign ? 'Bật' : 'Tắt'}</Tag> },
                  { key: 'status', label: 'Trạng thái', children: <Tag color={SLOT_STATUS_COLOR[slot.status]}>{STATUS_LABEL[slot.status]}</Tag> },
                ]} />
              ),
            }))}
          />
          <Flex justify="center">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filtered.length}
              size="small"
              showSizeChanger={false}
              showTotal={(total) => `${total} slot`}
              onChange={updatePagination}
            />
          </Flex>
        </Space>
      )}

      <Typography.Text type="secondary">
        * Slot có lịch sử giao hàng sẽ bị vô hiệu hóa thay vì xóa hoàn toàn để giữ dữ liệu lịch sử.
      </Typography.Text>
    </Space>
  );
}
