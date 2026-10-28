import { useEffect, useRef } from 'react';
import { AppstoreOutlined, CarOutlined, CheckCircleFilled, InboxOutlined, ShopOutlined, ToolOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import AdaptiveGrid from '../../../components/AdaptiveGrid';
import { UNIT_FALLBACKS, type UnitBranding } from '../../../context/BrandingContext';
import type { UnitConfig, UnitGoodsType } from '../../../lib/types';
import type { VehicleAvailabilityOption } from '../api';
import FieldFrame from '../components/FieldFrame';
import { FieldError, FieldHint } from '../components/FieldFeedback';
import { VEHICLE_INFO } from '../constants';
import type { FormState, RegisterFieldErrors, SetFormField, Unit } from '../types';

type UnitGoodsVehicleStepProps = {
  form: FormState;
  fieldErrors: RegisterFieldErrors;
  highlightedField: keyof FormState | null;
  publicUnits: UnitConfig[];
  publicUnitsLoading: boolean;
  publicUnitsMsg: string;
  unitConfig: UnitConfig | null;
  customGoodsTypes: UnitGoodsType[];
  vehicleAvailability: VehicleAvailabilityOption[];
  vehicleAvailabilityMsg: string;
  vehicleAvailabilityLoading: boolean;
  brandUnits: Record<Unit, UnitBranding>;
  hasPublicLocation: boolean;
  set: SetFormField;
};

const GOODS_OPTIONS = [
  { value: 'FRESH_FOOD', label: 'Hàng tươi sống / mát / đông lạnh', icon: <ShopOutlined /> },
  { value: 'GENERAL_GOODS', label: 'Hàng thường', icon: <InboxOutlined /> },
  { value: 'THI_CONG', label: 'Thi công', icon: <ToolOutlined /> },
] as const;

const VEHICLE_ICONS = { TRUCK: <CarOutlined />, MOTORBIKE: <CarOutlined />, OTHER: <CarOutlined /> } as const;

export default function UnitGoodsVehicleStep({
  form, fieldErrors, highlightedField, publicUnits, publicUnitsLoading, publicUnitsMsg, unitConfig,
  customGoodsTypes, vehicleAvailability, vehicleAvailabilityMsg, vehicleAvailabilityLoading, brandUnits,
  hasPublicLocation, set,
}: UnitGoodsVehicleStepProps) {
  const goodsRef = useRef<HTMLDivElement>(null);
  const vehicleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!form.receivingUnit) return;
    const timer = window.setTimeout(() => goodsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => window.clearTimeout(timer);
  }, [form.receivingUnit]);

  useEffect(() => {
    if (!form.goodsType) return;
    const timer = window.setTimeout(() => vehicleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => window.clearTimeout(timer);
  }, [form.goodsType]);

  function unitBrand(config: UnitConfig) {
    const legacyBrand = brandUnits[config.unit] ?? UNIT_FALLBACKS[config.unit];
    return {
      displayName: config.displayName || legacyBrand?.displayName || config.unit,
      description: config.description || legacyBrand?.description || config.shortName || config.unit,
      logoUrl: config.logoUrl ?? legacyBrand?.logoUrl ?? null,
    };
  }

  function selectUnit(config: UnitConfig) {
    if (form.unitConfigId === config.id) return;
    set('unitConfigId', config.id);
    set('receivingUnit', config.unit);
    set('goodsType', '');
    set('unitGoodsTypeId', '');
    set('vehicleType', '');
  }

  function renderVehicleChoice({ vehicleType, slotCount, capacity }: VehicleAvailabilityOption) {
    const info = VEHICLE_INFO[vehicleType];
    const active = form.vehicleType === vehicleType;
    return (
      <Button
        key={vehicleType}
        type="default"
        aria-pressed={active}
        className={`selection-card-button !h-auto !whitespace-normal ${active ? 'selection-card-button-selected' : ''}`}
        onClick={() => {
          if (!active) set('vehicleType', vehicleType);
        }}
      >
        {active && <CheckCircleFilled className="selection-card-check" aria-hidden />}
        <div className="space-y-1 py-2 text-center">
          <div className="text-lg">{VEHICLE_ICONS[vehicleType]}</div>
          <Typography.Text strong>{info.label}</Typography.Text>
          <Typography.Text type="secondary" className="block text-xs">{slotCount} vị trí · {capacity} lượt</Typography.Text>
        </div>
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      <FieldFrame field="receivingUnit" highlightedField={highlightedField} variant="choice">
        <Card size="small" title={<Space><AppstoreOutlined />Đơn vị giao hàng</Space>}>
          {!hasPublicLocation && <Alert type="info" showIcon title="Chọn khu vực từ nút nổi toàn cục để xem đơn vị nhận hàng." />}
          {hasPublicLocation && publicUnitsLoading && <Skeleton active paragraph={{ rows: 3 }} />}
          {hasPublicLocation && !publicUnitsLoading && publicUnits.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {publicUnits.map((config) => {
                const brand = unitBrand(config);
                const active = form.unitConfigId === config.id;
                return (
                  <Button key={config.id} type="default" block aria-pressed={active} className={`selection-card-button !h-auto !whitespace-normal !p-0 !text-left ${active ? 'selection-card-button-selected' : ''}`} onClick={() => selectUnit(config)}>
                    {active && <CheckCircleFilled className="selection-card-check" aria-hidden />}
                    <div className="flex min-h-20 w-full items-center gap-3 px-4 py-3 text-left">
                      <Avatar shape="square" size={40} className="shrink-0" src={config.logoUrl?.trim() || brand.logoUrl || undefined} icon={<AppstoreOutlined />} />
                      <div className="flex min-w-0 flex-1 flex-col items-start justify-center gap-0.5">
                        <Typography.Text strong className="block w-full whitespace-normal">{brand.displayName}</Typography.Text>
                        <Typography.Text type="secondary" className="block w-full whitespace-normal text-xs">Khu nhận hàng {brand.displayName}</Typography.Text>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
          {hasPublicLocation && !publicUnitsLoading && publicUnits.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={publicUnitsMsg || 'Khu vực này chưa có đơn vị nhận hàng đang hoạt động.'} />}
          {fieldErrors.receivingUnit && <FieldError text={fieldErrors.receivingUnit} />}
        </Card>
      </FieldFrame>

      {form.receivingUnit && <div ref={goodsRef}>
        <FieldFrame field="goodsType" highlightedField={highlightedField} variant="choice">
          <Card size="small" title={<Space><InboxOutlined />Loại hàng giao</Space>}>
            {!unitConfig && <Skeleton active paragraph={{ rows: 2 }} />}
            {unitConfig && customGoodsTypes.length > 0 && <div className="grid gap-3 sm:grid-cols-2">
              {customGoodsTypes.map((type) => {
                const active = form.unitGoodsTypeId === type.id;
                return <Button key={type.id} type="default" aria-pressed={active} className={`selection-card-button !h-auto !whitespace-normal ${active ? 'selection-card-button-selected' : ''}`} onClick={() => {
                  if (active) return;
                  set('goodsType', type.baseType);
                  set('unitGoodsTypeId', type.id);
                  set('vehicleType', '');
                }}>
                  {active && <CheckCircleFilled className="selection-card-check" aria-hidden />}
                  <div className="py-2 text-left"><Typography.Text strong>{type.name}</Typography.Text></div>
                </Button>;
              })}
            </div>}
            {unitConfig && customGoodsTypes.length === 0 && <div className="grid gap-3 sm:grid-cols-2">
              {GOODS_OPTIONS.filter((option) => (
                option.value === 'FRESH_FOOD' ? unitConfig.freshFoodEnabled : option.value === 'GENERAL_GOODS' ? unitConfig.generalGoodsEnabled : unitConfig.thiCongEnabled
              )).map((option) => {
                const active = form.goodsType === option.value && !form.unitGoodsTypeId;
                return <Button key={option.value} type="default" aria-pressed={active} className={`selection-card-button !h-auto !whitespace-normal ${active ? 'selection-card-button-selected' : ''}`} onClick={() => {
                  if (active) return;
                  set('goodsType', option.value);
                  set('unitGoodsTypeId', '');
                  set('vehicleType', '');
                }}>
                  {active && <CheckCircleFilled className="selection-card-check" aria-hidden />}
                  <div className="flex min-h-16 items-center gap-3 px-1 py-2 text-left"><span className="text-lg">{option.icon}</span><Typography.Text strong>{option.label}</Typography.Text></div>
                </Button>;
              })}
            </div>}
            {unitConfig?.sundayFreshFoodOnly && <Tag color="gold" className="mt-3">Chủ nhật chỉ nhận hàng tươi sống</Tag>}
            {fieldErrors.goodsType && <FieldError text={fieldErrors.goodsType} />}
          </Card>
        </FieldFrame>
      </div>}

      {form.goodsType && <div ref={vehicleRef}>
        <FieldFrame field="vehicleType" highlightedField={highlightedField} variant="choice">
          <Card size="small" title={<Space><CarOutlined />Phương tiện giao hàng</Space>}>
            {vehicleAvailabilityLoading && <Skeleton active paragraph={{ rows: 2 }} />}
            {!vehicleAvailabilityLoading && vehicleAvailability.length > 0 && <>
              <div className={`grid gap-3 md:hidden ${vehicleAvailability.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {vehicleAvailability.map(renderVehicleChoice)}
              </div>
              <AdaptiveGrid minColumnWidth={180} maxColumnWidth={240} className="hidden md:grid">
                {vehicleAvailability.map(renderVehicleChoice)}
              </AdaptiveGrid>
            </>}
            {!vehicleAvailabilityLoading && vehicleAvailability.length === 0 && <Alert type="warning" showIcon title={vehicleAvailabilityMsg || 'Không có phương tiện phù hợp cho loại hàng này.'} />}
            <FieldHint text={form.vehicleType && VEHICLE_INFO[form.vehicleType] ? VEHICLE_INFO[form.vehicleType].hint : 'Chọn đúng loại để hệ thống xếp đúng bãi.'} />
            {fieldErrors.vehicleType && <FieldError text={fieldErrors.vehicleType} />}
          </Card>
        </FieldFrame>
      </div>}
    </div>
  );
}
