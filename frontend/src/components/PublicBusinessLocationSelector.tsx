import { useEffect, useState } from 'react';
import { DownOutlined } from '@ant-design/icons';
import { Dropdown, Typography, type MenuProps } from 'antd';
import { useAuth } from '../context/AuthContext';
import { usePublicBusinessLocation } from '../context/PublicBusinessLocationContext';
import { canSelectPublicLocation } from '../lib/publicLocationAccess';

export default function PublicBusinessLocationSelector() {
  const {
    locations,
    selectedBusinessLocationId,
    selectedBusinessLocation,
    isLoading,
    error,
    selectPublicBusinessLocation,
  } = usePublicBusinessLocation();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [open, setOpen] = useState(false);
  const canSelect = canSelectPublicLocation(authLoading, isAuthenticated, user?.role);
  const name = selectedBusinessLocation?.locationName ?? 'Chọn khu vực';

  useEffect(() => { if (!canSelect) setOpen(false); }, [canSelect]);

  function handleSelect(businessLocationId: string) {
    if (!canSelect) return;
    selectPublicBusinessLocation(businessLocationId);
    setOpen(false);
  }

  const items: MenuProps['items'] = isLoading
    ? [{ key: 'loading', label: 'Đang tải khu vực...', disabled: true }]
    : error ? [{ key: 'error', label: error, disabled: true }]
      : locations.length ? locations.map((location) => ({ key: location.id, label: <span style={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{location.locationName}</span> }))
        : [{ key: 'empty', label: 'Không có khu vực đang hoạt động', disabled: true }];

  return (
      canSelect ? <Dropdown trigger={['click']} open={open} onOpenChange={setOpen} overlayStyle={{ maxWidth: 'calc(100vw - 24px)' }}
        menu={{ items, selectable: true, selectedKeys: selectedBusinessLocationId ? [selectedBusinessLocationId] : [], onClick: ({ key }) => handleSelect(key) }}>
        <button type="button" className="flex min-w-0 items-center gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Chọn khu vực hiển thị, hiện tại: ${name}`} aria-haspopup="menu" aria-expanded={open}>
        <Typography.Text strong className="min-w-0 text-sm sm:text-base" style={{ overflowWrap: 'anywhere', lineHeight: 1.25 }}>{name}</Typography.Text>
        <DownOutlined className="shrink-0 text-xs" />
        </button>
      </Dropdown> : <Typography.Text strong className="min-w-0 text-sm sm:text-base" style={{ overflowWrap: 'anywhere', lineHeight: 1.25 }}>{name}</Typography.Text>
  );
}
