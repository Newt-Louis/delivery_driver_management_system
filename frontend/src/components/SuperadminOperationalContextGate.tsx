import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
      <button
        type="button"
        className="fixed bottom-5 right-5 z-[55] flex h-12 min-w-12 items-center justify-center rounded-full bg-thiso-900 px-4 text-sm font-black text-white shadow-xl transition-transform hover:-translate-y-0.5 hover:bg-thiso-800"
        onClick={() => setOpen(true)}
        title="Chuyển khu vực vận hành"
        aria-label="Chuyển khu vực vận hành"
      >
        <span className="mr-2 text-[11px] uppercase tracking-wide text-thiso-300">BL</span>
        <span className="max-w-[120px] truncate">{currentLocation?.code ?? 'Chọn'}</span>
      </button>

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
