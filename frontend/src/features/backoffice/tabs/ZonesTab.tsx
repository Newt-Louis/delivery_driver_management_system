import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import {
  Alert,
  AutoComplete,
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Result,
  Row,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  theme,
} from 'antd';
import api from '../../../lib/api';
import type { Slot, UnitConfig, Zone } from '../../../lib/types';
import { STATUS_LABEL } from '../constants';
import ResponsiveDataToolbar, { SearchButton } from '../components/ResponsiveDataToolbar';
import AdaptiveGrid from '../../../components/AdaptiveGrid';

type ZoneForm = {
  code: string;
  name: string;
  unitConfigId: string;
};

const SLOT_STATUS_COLOR: Record<Slot['status'], 'success' | 'processing' | 'warning' | 'default'> = {
  AVAILABLE: 'success',
  OCCUPIED: 'processing',
  RESERVED: 'warning',
  MAINTENANCE: 'default',
};

function unitConfigLabel(unit?: Pick<UnitConfig, 'unit' | 'displayName' | 'shortName'> | null) {
  return unit?.displayName || unit?.shortName || unit?.unit || 'Không rõ đơn vị';
}

function errorMessage(error: unknown, fallback = 'Có lỗi xảy ra.') {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.error ?? response.response?.data?.message ?? fallback;
}

function ZoneModal({
  zone,
  unitConfigs,
  onClose,
  onSaved,
}: {
  zone: Zone | null;
  unitConfigs: UnitConfig[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(zone);
  const [form, setForm] = useState<ZoneForm>({
    code: zone?.code ?? '',
    name: zone?.name ?? '',
    unitConfigId: zone?.unitConfigId ?? unitConfigs[0]?.id ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof ZoneForm>(key: K, value: ZoneForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  }

  async function saveZone() {
    if (!form.code.trim() || !form.name.trim() || !form.unitConfigId) {
      setError('Bắt buộc nhập mã, tên khu và đơn vị.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = { ...form, code: form.code.trim().toUpperCase(), name: form.name.trim() };
      if (isEdit) {
        await api.patch(`/api/zones/${zone!.id}`, payload);
      } else {
        await api.post('/api/zones', payload);
      }
      onSaved();
    } catch (saveError) {
      setError(errorMessage(saveError, 'Không thể lưu khu.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      centered
      destroyOnHidden
      title={isEdit ? `Sửa khu ${zone?.code}` : 'Thêm khu mới'}
      width="min(680px, calc(100vw - 32px))"
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' } }}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Hủy</Button>,
        <Button key="save" type="primary" loading={saving} onClick={saveZone}>Lưu</Button>,
      ]}
    >
      <Form layout="vertical" requiredMark={false} onFinish={saveZone}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <Form.Item label="Mã khu" required>
              <Input
                value={form.code}
                disabled={isEdit}
                maxLength={10}
                placeholder="K6"
                onChange={(event) => setField('code', event.target.value.toUpperCase())}
              />
            </Form.Item>
          </Col>
          <Col xs={24} sm={16}>
            <Form.Item label="Tên khu" required>
              <Input value={form.name} maxLength={100} placeholder="Khu 6 – Khu vực mới" onChange={(event) => setField('name', event.target.value)} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Đơn vị" required>
          <Select
            value={form.unitConfigId || undefined}
            placeholder="Chọn đơn vị"
            options={unitConfigs.map((unit) => ({ value: unit.id, label: `${unit.icon?.trim() || '🏬'} ${unitConfigLabel(unit)}` }))}
            onChange={(value) => setField('unitConfigId', value)}
          />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} />}
      </Form>
    </Modal>
  );
}

export default function ZonesTab() {
  const queryClient = useQueryClient();
  const { token } = theme.useToken();
  const [unitFilter, setUnitFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [nameSearch, setNameSearch] = useState('');
  const [modalZone, setModalZone] = useState<Zone | null | undefined>(undefined);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 9;

  const { data: zones = [], isLoading, isError, refetch } = useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => (await api.get('/api/zones')).data,
  });
  const { data: unitConfigs = [] } = useQuery<UnitConfig[]>({
    queryKey: ['unit-configs'],
    queryFn: async () => (await api.get('/api/units/configs')).data,
  });

  function refreshZones() {
    queryClient.invalidateQueries({ queryKey: ['zones'] });
    queryClient.invalidateQueries({ queryKey: ['slots', 'all'] });
  }

  function closeModal() {
    setModalZone(undefined);
  }

  async function deleteZone(zone: Zone) {
    try {
      await api.delete(`/api/zones/${zone.id}`);
      setNotice({ type: 'success', message: `Đã xóa khu ${zone.code}.` });
      refreshZones();
    } catch (deleteError) {
      setNotice({ type: 'error', message: errorMessage(deleteError, 'Không thể xóa khu.') });
    }
  }

  const filteredZones = zones.filter((zone) => (
    (!unitFilter || zone.unitConfigId === unitFilter)
    && (!nameSearch || zone.name.toLocaleLowerCase('vi-VN').includes(nameSearch.toLocaleLowerCase('vi-VN')))
  ));
  const nameOptions = [...new Set(zones.map((zone) => zone.name.trim()).filter(Boolean))].map((name) => ({ value: name }));
  const totalPages = Math.max(1, Math.ceil(filteredZones.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedZones = filteredZones.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalSlots = zones.reduce((total, zone) => total + (zone._count?.slots ?? zone.slots?.length ?? 0), 0);
  const activeSlots = zones.reduce((total, zone) => total + (zone.slots?.length ?? 0), 0);
  const availableSlots = zones.reduce((total, zone) => total + (zone.slots?.filter((slot) => slot.status === 'AVAILABLE').length ?? 0), 0);

  function submitNameSearch() {
    setNameSearch(searchDraft.trim());
    setPage(1);
  }

  return (
    <Space orientation="vertical" size="large" className="w-full">
      {modalZone !== undefined && (
        <ZoneModal
          zone={modalZone}
          unitConfigs={unitConfigs}
          onClose={closeModal}
          onSaved={() => {
            closeModal();
            refreshZones();
            setNotice({ type: 'success', message: `Đã ${modalZone ? 'cập nhật' : 'tạo'} khu thành công.` });
          }}
        />
      )}

      {notice && <Alert type={notice.type} title={notice.message} showIcon closable onClose={() => setNotice(null)} />}

      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Tổng khu" value={zones.length} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Khu có slot" value={zones.filter((zone) => (zone._count?.slots ?? zone.slots?.length ?? 0) > 0).length} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Tổng slot" value={totalSlots} suffix={<Tag>{activeSlots} kích hoạt</Tag>} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Slot trống" value={availableSlots} suffix={<Tag color="success">Sẵn sàng</Tag>} /></Card>
        </Col>
      </Row>

      <ResponsiveDataToolbar
        filters={(
          <>
            <Space orientation="vertical" size={4} className="w-full sm:w-auto">
              <Typography.Text type="secondary">Tìm tên khu</Typography.Text>
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
                <Input.Search allowClear placeholder="Nhập tên khu" enterButton={<SearchButton />} onSearch={submitNameSearch} />
              </AutoComplete>
            </Space>
            <Space orientation="vertical" size={4}>
              <Typography.Text type="secondary">Đơn vị</Typography.Text>
              <Select
                className="min-w-56"
                allowClear
                placeholder="Tất cả đơn vị"
                value={unitFilter || undefined}
                options={unitConfigs.map((unit) => ({ value: unit.id, label: `${unit.icon?.trim() || '🏬'} ${unitConfigLabel(unit)}` }))}
                onChange={(value) => {
                  setUnitFilter(value ?? '');
                  setPage(1);
                }}
              />
            </Space>
          </>
        )}
        createAction={(
          <Tooltip title={unitConfigs.length === 0 ? 'Cần có ít nhất một đơn vị để tạo khu.' : undefined}>
            <span>
              <Button type="primary" icon={<PlusOutlined />} disabled={unitConfigs.length === 0} onClick={() => setModalZone(null)}>Thêm khu</Button>
            </span>
          </Tooltip>
        )}
      />

      {isError ? (
        <Result status="error" title="Không thể tải danh sách khu" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />
      ) : isLoading ? (
        <Card size="small" loading />
      ) : pagedZones.length === 0 ? (
        <Empty description="Chưa có khu phù hợp" />
      ) : (
        <>
          <AdaptiveGrid minColumnWidth={300}>
            {pagedZones.map((zone) => {
              const slots = zone.slots ?? [];
              const slotCount = zone._count?.slots ?? slots.length;
              const trucks = slots.filter((slot) => slot.vehicleType === 'TRUCK').length;
              const motorbikes = slots.filter((slot) => slot.vehicleType === 'MOTORBIKE').length;
              const unit = zone.unitConfig ?? unitConfigs.find((unitConfig) => unitConfig.id === zone.unitConfigId);
              const unitName = unitConfigLabel(unit);
              const unitColor = unit?.primaryColor || token.colorPrimary;
              const canDelete = slotCount === 0;
              const deleteButton = <Button color="danger" variant="solid" size="small" icon={<DeleteOutlined />} disabled={!canDelete} aria-label={`Xóa khu ${zone.code}`} />;

              return (
                <Card
                  key={zone.id}
                  size="small"
                  className="h-full w-full"
                  cover={<div aria-hidden className="h-24" style={{ backgroundColor: unitColor }} />}
                  actions={[
                    <Tooltip key="edit" title="Chỉnh sửa khu">
                      <Button color="gold" variant="solid" size="small" icon={<EditOutlined />} aria-label={`Chỉnh sửa khu ${zone.code}`} onClick={() => setModalZone(zone)} />
                    </Tooltip>,
                    canDelete ? (
                      <Popconfirm
                        key="delete"
                        title={`Xóa khu ${zone.code}?`}
                        description="Khu không còn slot sẽ bị xóa vĩnh viễn."
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ color: 'danger', variant: 'solid' }}
                        onConfirm={() => deleteZone(zone)}
                      >
                        {deleteButton}
                      </Popconfirm>
                    ) : (
                      <Tooltip key="delete-disabled" title="Chuyển hết slot ra khỏi khu trước khi xóa.">
                        <span>{deleteButton}</span>
                      </Tooltip>
                    ),
                  ]}
                >
                  <Space orientation="vertical" size="middle" className="w-full">
                    <Card.Meta
                      avatar={(
                        <Avatar
                          src={unit?.logoUrl || undefined}
                          style={{ backgroundColor: 'transparent', color: token.colorText }}
                        >
                          {unit?.icon?.trim() || '🏬'}
                        </Avatar>
                      )}
                      title={(
                        <Flex justify="space-between" align="center" gap="small">
                          <Typography.Text strong code>{zone.code}</Typography.Text>
                          <Tag>{slotCount} slot</Tag>
                        </Flex>
                      )}
                      description={<Tooltip title={zone.name}><Typography.Text ellipsis className="block max-w-full">{zone.name}</Typography.Text></Tooltip>}
                    />
                    <Space size="small" className="w-full">
                      <Typography.Text type="secondary">Đơn vị:</Typography.Text>
                      <Tooltip title={unitName}><Tag>{unit?.icon?.trim() || '🏬'} {unitName}</Tag></Tooltip>
                    </Space>
                    <Descriptions size="small" column={2} items={[
                      { key: 'trucks', label: 'Xe tải', children: trucks },
                      { key: 'motorbikes', label: 'Xe máy', children: motorbikes },
                    ]} />
                    {slots.length > 0 ? (
                      <Space size={[4, 4]} wrap>
                        {slots.map((slot) => (
                          <Tooltip key={slot.id} title={`${slot.name} · ${STATUS_LABEL[slot.status]}`}>
                            <Tag color={SLOT_STATUS_COLOR[slot.status]}>{slot.code}</Tag>
                          </Tooltip>
                        ))}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">Chưa có slot nào.</Typography.Text>
                    )}
                  </Space>
                </Card>
              );
            })}
          </AdaptiveGrid>
          <Flex justify="center">
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={filteredZones.length}
              size="small"
              showSizeChanger={false}
              showTotal={(total) => `Tổng ${total} khu`}
              hideOnSinglePage
              onChange={setPage}
            />
          </Flex>
        </>
      )}
    </Space>
  );
}
