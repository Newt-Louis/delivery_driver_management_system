import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { DownOutlined } from '@ant-design/icons';
import { Dropdown, Typography, type MenuProps } from 'antd';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import type { BusinessLocation } from '../lib/types';
import BusinessLocationSelectorModal from './BusinessLocationSelectorModal';

function locationErrorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string; error?: string } } }).response;
    return response?.data?.message ?? response?.data?.error ?? 'Không thể tải khu vực vận hành.';
  }
  return 'Không thể tải khu vực vận hành.';
}

export default function SuperadminOperationalContextGate() {
  const {
    user,
    isAuthenticated,
    isLoading,
    listOperationalLocations,
    selectOperationalLocation,
  } = useAuth();
  const { mall } = useBranding();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSuperadmin = isAuthenticated && user?.role === 'SUPERADMIN';
  const mustChooseLocation = isSuperadmin && !user?.businessLocationId;
  const currentLocation = useMemo(
    () => locations.find((location) => location.id === user?.businessLocationId) ?? null,
    [locations, user?.businessLocationId],
  );

  const loadLocations = useCallback(async () => {
    if (!isSuperadmin) return;
    setLoadingLocations(true);
    setError(null);
    try {
      setLocations(await listOperationalLocations());
    } catch (err) {
      setError(locationErrorMessage(err));
    } finally {
      setLoadingLocations(false);
    }
  }, [isSuperadmin, listOperationalLocations]);

  useEffect(() => {
    if (isLoading || (!open && !mustChooseLocation)) return;
    loadLocations();
  }, [isLoading, loadLocations, mustChooseLocation, open]);

  if (!isSuperadmin) return null;

  async function handleSelect(businessLocationId: string) {
    if (saving) return;
    if (businessLocationId === user?.businessLocationId) { setOpen(false); return; }
    setSaving(true);
    setError(null);
    try {
      await selectOperationalLocation(businessLocationId);
      await queryClient.invalidateQueries();
      setOpen(false);
    } catch (err) {
      setError(locationErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const locationName = currentLocation?.locationName || (user?.businessLocationId ? mall.locationName || mall.mallName : 'Chọn khu vực');
  const items: MenuProps['items'] = loadingLocations
    ? [{ key: 'loading', label: 'Đang tải khu vực...', disabled: true }]
    : error ? [{ key: 'error', label: error, disabled: true }]
      : locations.length ? locations.map((location) => ({ key: location.id, label: location.locationName, disabled: saving }))
        : [{ key: 'empty', label: 'Không có khu vực đang hoạt động', disabled: true }];

  return (
    <>
      <Dropdown trigger={['click']} open={open && !mustChooseLocation} onOpenChange={(next) => { if (!saving) setOpen(next); }}
        menu={{ items, selectable: true, selectedKeys: user?.businessLocationId ? [user.businessLocationId] : [], onClick: ({ key }) => { void handleSelect(key); } }}>
        <button type="button" className="flex min-w-0 items-center gap-1.5 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`Chuyển khu vực vận hành, hiện tại: ${locationName}`} aria-haspopup="menu" aria-expanded={open && !mustChooseLocation}>
          <Typography.Text strong ellipsis className="max-w-32 text-sm sm:max-w-48">{locationName}</Typography.Text>
          <DownOutlined className="shrink-0 text-xs" />
        </button>
      </Dropdown>

      <BusinessLocationSelectorModal
        open={mustChooseLocation}
        required
        locations={locations}
        currentId={user?.businessLocationId}
        loading={loadingLocations}
        saving={saving}
        error={error}
        onSelect={handleSelect}
      />
    </>
  );
}
