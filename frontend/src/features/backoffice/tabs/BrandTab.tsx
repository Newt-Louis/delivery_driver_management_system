import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DeleteOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Col, ColorPicker, Empty, Flex, Form, Input, Result, Row, Space, Tooltip, Typography, Upload } from 'antd';
import api from '../../../lib/api';
import { useBranding } from '../../../context/BrandingContext';
import type { UnitConfig } from '../../../lib/types';
import { hasPendingUploadFile, uploadDatafileAsset } from '../../../lib/datafileUpload';
import AdaptiveGrid from '../../../components/AdaptiveGrid';

type BrandForm = {
  displayName: string;
  shortName: string;
  description: string;
  icon: string;
  logoUrl: string | null;
  logoOriginalName?: string;
  logoFile?: File;
  primaryColor: string;
};

function normalizeHexColor(value: string) {
  const color = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  if (/^[0-9a-fA-F]{6}$/.test(color)) return `#${color}`;
  return null;
}

function errorMessage(error: unknown, fallback = 'Không thể lưu nhận diện đơn vị.') {
  const response = error as { response?: { data?: { error?: string; message?: string } } };
  return response.response?.data?.error ?? response.response?.data?.message ?? fallback;
}

async function uploadUnitLogoIfNeeded(unitConfigId: string, value: string | null, originalName: string | undefined, file?: File) {
  if (!hasPendingUploadFile(file)) return value ?? null;
  const uploaded = await uploadDatafileAsset({
    scope: 'UNIT_CONFIG',
    category: 'LOGO',
    unitConfigId,
    originalName: originalName ?? 'unit-logo.png',
    file,
  });
  return uploaded.publicUrl;
}

function UnitBrandCard({ unit, onSaved }: { unit: UnitConfig; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [form, setForm] = useState<BrandForm>({
    displayName: unit.displayName || unit.unit,
    shortName: unit.shortName || unit.displayName || unit.unit,
    description: unit.description || '',
    icon: unit.icon || '',
    logoUrl: unit.logoUrl,
    primaryColor: unit.primaryColor,
  });

  function setField<Key extends keyof BrandForm>(field: Key, value: BrandForm[Key]) {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice(null);
  }

  async function saveUnit() {
    const primaryColor = normalizeHexColor(form.primaryColor);
    if (!primaryColor) {
      setNotice({ type: 'error', message: 'Màu thương hiệu phải có dạng #RRGGBB.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const logoUrl = await uploadUnitLogoIfNeeded(unit.id, form.logoUrl, form.logoOriginalName, form.logoFile);
      const { logoOriginalName: _logoOriginalName, logoFile: _logoFile, ...payload } = { ...form, logoUrl, primaryColor };
      void _logoOriginalName;
      void _logoFile;
      await api.patch(`/api/units/${unit.unit}/config`, payload);
      setForm((current) => ({ ...current, primaryColor, logoUrl, logoOriginalName: undefined, logoFile: undefined }));
      onSaved();
      setNotice({ type: 'success', message: 'Đã lưu nhận diện đơn vị.' });
    } catch (error) {
      setNotice({ type: 'error', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  function selectLogo(file: File) {
    if (file.size > 102400 * 1000) {
      setNotice({ type: 'error', message: 'File logo vượt quá giới hạn 100MB.' });
      return Upload.LIST_IGNORE;
    }
    setForm((current) => ({ ...current, logoUrl: URL.createObjectURL(file), logoOriginalName: file.name, logoFile: file }));
    setNotice(null);
    return false;
  }

  function clearLogo() {
    setForm((current) => ({ ...current, logoUrl: null, logoOriginalName: undefined, logoFile: undefined }));
    setNotice(null);
  }

  const title = form.displayName || unit.unit;

  return (
    <Card
      size="small"
      className="h-full"
      cover={<div aria-hidden className="h-6 lg:h-8" style={{ backgroundColor: form.primaryColor }} />}
    >
      <Form layout="vertical" requiredMark={false}>
        <Form.Item label="Logo đơn vị">
          <Flex gap="middle" align="center" wrap="wrap">
            <Avatar shape="square" size={64} src={form.logoUrl || undefined} alt={`Logo ${title}`} style={{ backgroundColor: 'transparent' }}>{form.icon || '🏬'}</Avatar>
            <Space orientation="vertical" size="small">
              <Upload accept="image/png,image/jpeg,image/webp,image/gif" showUploadList={false} beforeUpload={selectLogo}>
                <Button icon={<UploadOutlined />}>{form.logoUrl ? 'Thay logo' : 'Tải lên logo'}</Button>
              </Upload>
              {form.logoUrl && <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={clearLogo}>Xóa logo</Button>}
            </Space>
            <Typography.Text type="secondary" className="text-xs">PNG, JPG, WebP, GIF · tối đa 100MB. Ảnh được tải lên khi lưu.</Typography.Text>
          </Flex>
        </Form.Item>
        <Row gutter={[12, 0]}>
          <Col xs={24} sm={12}><Form.Item label="Tên hiển thị đầy đủ"><Input value={form.displayName} placeholder={unit.unit} onChange={(event) => setField('displayName', event.target.value)} /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item label="Tên rút gọn" extra="Dùng trên màn hình TV hàng chờ."><Input value={form.shortName} placeholder={unit.unit} onChange={(event) => setField('shortName', event.target.value)} /></Form.Item></Col>
          <Col xs={24} sm={8}><Form.Item label="Icon" extra="Emoji hoặc class icon, có thể để trống."><Input value={form.icon} placeholder="🏬" maxLength={40} onChange={(event) => setField('icon', event.target.value)} /></Form.Item></Col>
          <Col xs={24} sm={16}><Form.Item label="Mô tả / địa chỉ cổng" extra="Ví dụ: Siêu thị — Cửa B3, tầng hầm."><Input value={form.description} placeholder="Ví dụ: Siêu thị - Cửa B3" onChange={(event) => setField('description', event.target.value)} /></Form.Item></Col>
          <Col xs={24} sm={12}><Form.Item label="Màu thương hiệu"><Space.Compact className="w-full"><ColorPicker value={normalizeHexColor(form.primaryColor) ?? unit.primaryColor} format="hex" disabledAlpha onChange={(color) => setField('primaryColor', color.toHexString())} /><Input value={form.primaryColor} placeholder={unit.primaryColor} onChange={(event) => setField('primaryColor', event.target.value)} /></Space.Compact></Form.Item></Col>
        </Row>
        {notice && <Alert className="mb-4" type={notice.type} showIcon title={notice.message} closable onClose={() => setNotice(null)} />}
        <Flex justify="end"><Button type="primary" loading={saving} onClick={saveUnit}>Lưu {title}</Button></Flex>
      </Form>
    </Card>
  );
}

export default function BrandTab() {
  const { refresh } = useBranding();
  const queryClient = useQueryClient();
  const { data: unitConfigs = [], isLoading, isError, refetch } = useQuery<UnitConfig[]>({ queryKey: ['unit-configs'], queryFn: async () => (await api.get('/api/units/configs')).data });

  function refreshUnits() {
    refresh();
    queryClient.invalidateQueries({ queryKey: ['unit-configs'] });
  }

  if (isError) return <Result status="error" title="Không thể tải nhận diện đơn vị" extra={<Button type="primary" icon={<ReloadOutlined />} onClick={() => refetch()}>Thử lại</Button>} />;
  if (isLoading) return <Card size="small" loading />;
  if (unitConfigs.length === 0) return <Empty description="Khu vực hiện tại chưa có đơn vị nào." image={Empty.PRESENTED_IMAGE_SIMPLE} />;

  return <AdaptiveGrid minColumnWidth={320} maxColumnWidth={520}>{unitConfigs.map((unit) => <UnitBrandCard key={unit.id} unit={unit} onSaved={refreshUnits} />)}</AdaptiveGrid>;
}
