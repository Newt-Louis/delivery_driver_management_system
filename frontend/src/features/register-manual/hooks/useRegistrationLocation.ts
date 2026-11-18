import { useAuth } from '../../../context/AuthContext';
import { usePublicBusinessLocation } from '../../../context/PublicBusinessLocationContext';
import { canSelectPublicLocation } from '../../../lib/publicLocationAccess';

/**
 * Location a registration (quick or manual) is made for.
 * - Drivers / anonymous and SUPERADMIN: the location chosen in the public header selector.
 * - Logged-in staff (other roles) cannot change the header selection: their account location is used.
 * `businessLocationId` is null until a location is known; registration must not proceed then.
 */
export function useRegistrationLocation() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const {
    locations,
    selectedBusinessLocationId,
    selectedBusinessLocation,
    isLoading,
    error,
    selectPublicBusinessLocation,
  } = usePublicBusinessLocation();
  const canSelect = canSelectPublicLocation(authLoading, isAuthenticated, user?.role);
  const usesAccountLocation = !authLoading && isAuthenticated && !canSelect;

  const businessLocationId = usesAccountLocation
    ? user?.businessLocationId ?? null
    : selectedBusinessLocationId;
  const location = usesAccountLocation
    ? locations.find((item) => item.id === businessLocationId) ?? null
    : selectedBusinessLocation;

  return {
    businessLocationId,
    locationName: location?.locationName ?? '',
    canSelect,
    locations,
    isLoading: isLoading || authLoading,
    error,
    selectLocation: selectPublicBusinessLocation,
  };
}
