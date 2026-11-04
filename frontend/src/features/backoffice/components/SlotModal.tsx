import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DeleteOutlined, DragOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Col, Flex, Form, Input, InputNumber, List, Modal, Row, Select, Space, Switch, Tag, Typography } from 'antd';
import api from '../../../lib/api';
import type { Slot, Zone, GoodsType } from '../../../lib/types';
import { GOODS_LABELS } from '../constants';
import { SLOT_GOODS, slotGoodsPriority } from '../slotGoods';

const slotSchema = z.object({
  code: z.string().min(1, 'Bắt buộc').max(20),
  name: z.string().min(1, 'Bắt buộc').max(50),
  assignedUnit: z.string().trim().min(1, 'Bắt buộc chọn đơn vị').transform((value) => value.toUpperCase()),
  vehicleType: z.enum(['TRUCK', 'MOTORBIKE']).default('TRUCK'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE']).default('AVAILABLE'),
  zoneId: z.string().min(1, 'Bắt buộc chọn khu'),
  autoAssign: z.boolean().default(true),
  maxCapacity: z.number().int().min(1).max(10).default(1),
  acceptedGoods: z.array(z.enum(['FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG'])).default([]),
  goodsPriority: z.array(z.enum(['FRESH_FOOD', 'AUTO_WAREHOUSE', 'GENERAL_GOODS', 'THI_CONG'])).default([]),
});
type SlotForm = z.infer<typeof slotSchema>;

export default function SlotModal({ slot, zones, onClose, onSaved }: { slot?: Slot | null; zones: Zone[]; onClose: () => void; onSaved: () => void }) {
  const [serverError, setServerError] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const isEdit = !!slot;
  const unitOptions = Array.from(new Map(
    zones
      .filter((zone) => zone.unitConfig?.unit)
      .map((zone) => [zone.unitConfig!.unit, zone.unitConfig!]),
  ).values());
  const defaultUnit = slot?.assignedUnit ?? unitOptions[0]?.unit ?? '';

  const { register, handleSubmit, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<SlotForm>({
    resolver: zodResolver(slotSchema),
    defaultValues: slot
      ? { code: slot.code, name: slot.name, assignedUnit: slot.assignedUnit, vehicleType: slot.vehicleType, status: slot.status, zoneId: slot.zoneId ?? '', autoAssign: slot.autoAssign, maxCapacity: slot.maxCapacity ?? 1, acceptedGoods: slot.acceptedGoods as GoodsType[], goodsPriority: slotGoodsPriority(slot) }
      : { vehicleType: 'TRUCK', assignedUnit: defaultUnit, status: 'AVAILABLE', zoneId: '', autoAssign: true, maxCapacity: 1, acceptedGoods: [], goodsPriority: SLOT_GOODS },
  });

  const goodsPriority = watch('goodsPriority') ?? [];
  const autoAssign = watch('autoAssign');
  const assignedUnit = watch('assignedUnit');
  const matchingZones = zones.filter((zone) => zone.unitConfig?.unit === assignedUnit);

  function setPriority(next: GoodsType[]) {
    setValue('goodsPriority', next, { shouldDirty: true, shouldValidate: true });
  }

  function addGoods(goodsType: GoodsType) {
    if (goodsPriority.includes(goodsType)) return;
    setPriority([...goodsPriority, goodsType]);
  }

  function removeGoods(goodsType: GoodsType) {
    setPriority(goodsPriority.filter((item) => item !== goodsType));
  }

  function moveGoods(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const next = [...goodsPriority];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPriority(next);
  }

  async function onSubmit(data: SlotForm) {
    setServerError('');
    try {
      const orderedGoods = data.goodsPriority.filter((goodsType) => SLOT_GOODS.includes(goodsType));
      if (orderedGoods.length === 0) {
        setServerError('Vui lòng giữ ít nhất một loại hàng nhận cho slot.');
        return;
      }
      const acceptedGoods = orderedGoods.length === SLOT_GOODS.length ? [] : orderedGoods;
      const payload = { ...data, zoneId: data.zoneId, acceptedGoods, goodsPriority: orderedGoods };
      if (isEdit) {
        await api.patch(`/api/slots/${slot!.id}`, { name: payload.name, assignedUnit: payload.assignedUnit, vehicleType: payload.vehicleType, status: payload.status, zoneId: payload.zoneId, autoAssign: payload.autoAssign, maxCapacity: payload.maxCapacity, acceptedGoods: payload.acceptedGoods, goodsPriority: payload.goodsPriority });
      } else {
        await api.post('/api/slots', payload);
      }
      onSaved();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg ?? 'Lỗi lưu slot.');
    }
  }

  return (
    <Modal
      open
      title={isEdit ? `Chỉnh sửa slot — ${slot!.code}` : 'Thêm slot mới'}
      onCancel={onClose}
      footer={null}
      centered
      width="min(768px, calc(100vw - 32px))"
      styles={{ body: { maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto', padding: '16px 8px 16px 16px' } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Form layout="vertical" component={false}>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Mã slot" required validateStatus={errors.code ? 'error' : ''} help={errors.code?.message}>
                <Input {...register('code')} placeholder="T10, M16..." disabled={isEdit} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Tên hiển thị" required validateStatus={errors.name ? 'error' : ''} help={errors.name?.message}>
                <Input {...register('name')} placeholder="Slot tải 10" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Đơn vị" required validateStatus={errors.assignedUnit ? 'error' : ''} help={errors.assignedUnit?.message}>
                <Controller
                  control={control}
                  name="assignedUnit"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      options={unitOptions.map((unit) => ({ value: unit.unit, label: unit.displayName || unit.unit }))}
                    />
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Loại phương tiện" required>
                <Controller
                  control={control}
                  name="vehicleType"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'TRUCK', label: 'Xe tải' },
                        { value: 'MOTORBIKE', label: 'Xe máy' },
                      ]}
                    />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item label="Khu (Zone)" required validateStatus={errors.zoneId ? 'error' : ''} help={errors.zoneId?.message}>
                <Controller
                  control={control}
                  name="zoneId"
                  render={({ field }) => (
                    <Select
                      value={field.value || undefined}
                      placeholder="Chọn khu"
                      onChange={field.onChange}
                      options={matchingZones.map((zone) => ({ value: zone.id, label: `${zone.code} – ${zone.name}` }))}
                    />
                  )}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Trạng thái ban đầu">
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: 'AVAILABLE', label: 'Trống' },
                        { value: 'RESERVED', label: 'Đặt trước' },
                        { value: 'MAINTENANCE', label: 'Bảo trì' },
                      ]}
                    />
                  )}
                />
              </Form.Item>
            </Col>
          </Row>

          <Card size="small" className="mb-4">
            <Flex justify="space-between" align="center" gap="middle">
              <Space orientation="vertical" size={0}>
                <Typography.Text strong>Tự động điều xe</Typography.Text>
                <Typography.Text type="secondary">Hệ thống tự gọi xe vào slot khi có chỗ trống.</Typography.Text>
              </Space>
              <Switch checked={autoAssign} onChange={(checked) => setValue('autoAssign', checked, { shouldDirty: true })} />
            </Flex>
          </Card>

          <Form.Item label="Sức chứa tối đa (xe/slot)">
            <Controller
              control={control}
              name="maxCapacity"
              render={({ field }) => (
                <InputNumber min={1} max={10} value={field.value} onChange={(value) => field.onChange(value ?? 1)} />
              )}
            />
            <Typography.Text type="secondary" className="ml-2"> Xe tải: 1 — xe máy: thường là 3.</Typography.Text>
          </Form.Item>

          <Form.Item label="Loại hàng nhận">
            <Card size="small">
              <List
                size="small"
                dataSource={goodsPriority}
                locale={{ emptyText: 'Chưa có loại hàng nhận.' }}
                renderItem={(goodsType, index) => (
                  <List.Item
                    draggable
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) moveGoods(dragIndex, index);
                      setDragIndex(null);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    actions={[
                      <Button key="remove" type="text" color="danger" icon={<DeleteOutlined />} onClick={() => removeGoods(goodsType)}>
                        Bỏ
                      </Button>,
                    ]}
                  >
                    <Space>
                      <Tag>{index + 1}</Tag>
                      <DragOutlined aria-label="Kéo để sắp xếp" />
                      <Typography.Text>{GOODS_LABELS[goodsType]}</Typography.Text>
                    </Space>
                  </List.Item>
                )}
              />
              <Space wrap className="mt-3">
                {SLOT_GOODS.filter((goodsType) => !goodsPriority.includes(goodsType)).map((goodsType) => (
                  <Button key={goodsType} type="dashed" icon={<PlusOutlined />} onClick={() => addGoods(goodsType)}>
                    {GOODS_LABELS[goodsType]}
                  </Button>
                ))}
              </Space>
              {goodsPriority.length === SLOT_GOODS.length && <Typography.Text type="secondary" className="mt-3 block">Slot nhận tất cả loại hàng theo thứ tự ưu tiên ở trên.</Typography.Text>}
              {goodsPriority.length < SLOT_GOODS.length && <Typography.Text type="secondary" className="mt-3 block">Slot chỉ nhận các loại hàng đang nằm trong danh sách ưu tiên.</Typography.Text>}
            </Card>
          </Form.Item>

          {serverError && <Alert type="error" title={serverError} showIcon className="mb-4" />}
          <Flex justify="end" gap="small">
            <Button onClick={onClose}>Hủy</Button>
            <Button
              htmlType="submit"
              type={isEdit ? 'default' : 'primary'}
              color={isEdit ? 'gold' : undefined}
              variant={isEdit ? 'solid' : undefined}
              loading={isSubmitting}
            >
              {isEdit ? 'Lưu thay đổi' : 'Tạo slot'}
            </Button>
          </Flex>
        </Form>
      </form>
    </Modal>
  );
}
