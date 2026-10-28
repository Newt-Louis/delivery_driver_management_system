import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EnvironmentOutlined } from '@ant-design/icons';
import { FloatButton } from 'antd';
import { useAuth } from '../context/AuthContext';
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
    if (isLoading || !isSuperadmin) return;
    if (mustChooseLocation) setOpen(true);
  }, [isLoading, isSuperadmin, mustChooseLocation]);

  useEffect(() => {
    if (!open && !mustChooseLocation) return;
    loadLocations();
  }, [loadLocations, mustChooseLocation, open]);

  if (!isSuperadmin) return null;

  async function handleSelect(businessLocationId: string) {
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

  return (
    <>
      <FloatButton
        type="primary"
        shape="square"
        icon={<EnvironmentOutlined />}
        content={currentLocation?.code ?? 'Chọn'}
        tooltip="Chuyển khu vực vận hành"
        onClick={() => setOpen(true)}
        aria-label="Chuyển khu vực vận hành"
      />

      <BusinessLocationSelectorModal
        open={open || mustChooseLocation}
        required={mustChooseLocation}
        locations={locations}
        currentId={user?.businessLocationId}
        loading={loadingLocations}
        saving={saving}
        error={error}
        onSelect={handleSelect}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
