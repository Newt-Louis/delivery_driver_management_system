import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Modal, Radio, Space, Spin, Typography } from 'antd';
import type { DeliveryRegistration, UnitDispatch } from '../../../lib/types';
import { fetchBorrowableSlots } from '../api';
import { GOODS_CSV_LABEL, VEHICLE_LABEL } from '../constants';
import type { BorrowableSlot } from '../types';
import { getDeliveryUnitConfig, getTicketCode, getUnitMeta } from '../utils';
import UnitBrandMark from './UnitBrandMark';

interface Props {
  delivery: DeliveryRegistration;
  preselectedSlotId?: string;
  unitConfig?: UnitDispatch['unitConfig'];
  onClose: () => void;
  onCall: (slotId: string) => void;
  loading: boolean;
}

/**
 * "Mượn slot" popup for a WAITING delivery. Slot options come from
 * GET /api/deliveries/:id/borrowable-slots (same vehicle type, same BusinessLocation,
 * not limited to the operator's unit scope):
 *  - "Cùng đơn vị": same unit, still has free capacity
 *  - "Khác đơn vị": other units, completely empty
 */
export default function CallModal({ delivery, preselectedSlotId, unitConfig, onClose, onCall, loading }: Props) {
  const [selected, setSelected] = useState(preselectedSlotId ?? '');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['borrowable-slots', delivery.id],
    queryFn: () => fetchBorrowableSlots(delivery.id),
    staleTime: 0,
  });

  const config = getDeliveryUnitConfig(delivery, unitConfig);
  const meta = getUnitMeta(delivery.receivingUnit, config);
  const ticket = getTicketCode(delivery, config);
  const groups: Array<{ key: string; title: string; slots: BorrowableSlot[] }> = [
    { key: 'same', title: 'Cùng đơn vị', slots: data?.sameUnit ?? [] },
    { key: 'other', title: 'Khác đơn vị', slots: data?.otherUnits ?? [] },
  ];
  const options = groups.flatMap((group) => group.slots);
  const chosen = options.find((slot) => slot.id === selected);
  const preselectedMissing = !!preselectedSlotId && !!data && !options.some((slot) => slot.id === preselectedSlotId);

  return (
    <Modal
      open
      title="Mượn slot"
      onCancel={onClose}
      maskClosable={!loading}
      keyboard={!loading}
      closable={!loading}
      footer={(
        <Space>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" loading={loading} disabled={!chosen} onClick={() => chosen && onCall(chosen.id)}>
            Gọi → {chosen?.name ?? '...'}
          </Button>
        </Space>
      )}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Space><UnitBrandMark meta={meta} />{meta.label} {ticket}</Space>
        <Typography.Title level={4} style={{ margin: 0 }}>{delivery.vehiclePlate}</Typography.Title>
        <div>{delivery.vendorName} · {VEHICLE_LABEL[delivery.vehicleType]} · {delivery.registrationCode}</div>
        <Typography.Text strong>{GOODS_CSV_LABEL[delivery.goodsType] ?? delivery.goodsType}</Typography.Text>
        {!!delivery.callCount && <Alert type="warning" showIcon title={`Đã gọi ${delivery.callCount} lần trước`} />}
        {preselectedSlotId && !preselectedMissing && chosen?.id === preselectedSlotId && (
          <Alert type="info" showIcon title={`Hệ thống đề xuất: ${chosen.name}`} />
        )}
        {preselectedMissing && <Alert type="warning" showIcon title="Vị trí được đề xuất không còn trống. Vui lòng chọn vị trí khác." />}

        {isLoading && <Spin size="small"><div style={{ minHeight: 60 }} /></Spin>}
        {isError && <Alert type="error" showIcon title="Không thể tải danh sách vị trí" action={<Button size="small" onClick={() => refetch()}>Thử lại</Button>} />}
        {data && (
          <Radio.Group value={selected} onChange={(event) => setSelected(event.target.value)} style={{ width: '100%' }}>
            {groups.map((group) => (
              <div key={group.key} className="mb-4">
                <Typography.Title level={5}>{group.title} ({group.slots.length})</Typography.Title>
                {group.slots.length === 0
                  ? <Typography.Text type="secondary">Không có vị trí trống</Typography.Text>
                  : (
                    <Space wrap>
                      {group.slots.map((slot) => {
                        const slotMeta = getUnitMeta(slot.unitConfig.unit, slot.unitConfig);
                        return (
                          <Radio.Button
                            key={slot.id}
                            value={slot.id}
                            style={{ height: 'auto', minHeight: 44, maxWidth: '100%', whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                          >
                            <Space size={6}>
                              {group.key === 'other' && <UnitBrandMark meta={slotMeta} />}
                              <span>
                                {slot.name}
                                {slot.maxCapacity > 1 && ` (${slot.activeCount}/${slot.maxCapacity})`}
                                {group.key === 'other' && ` · ${slotMeta.label}`}
                              </span>
                            </Space>
                          </Radio.Button>
                        );
                      })}
                    </Space>
                  )}
              </div>
            ))}
          </Radio.Group>
        )}
        {data && options.length === 0 && <Empty description="Không còn vị trí trống cùng loại xe" />}
      </Space>
    </Modal>
  );
}
