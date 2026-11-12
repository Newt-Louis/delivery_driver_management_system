/**
 * Registry of seeding kinds exposed by `/api/seeding/run`.
 * Add a new kind here, implement its runner in `seedingService.ts`, and add the
 * matching option to `frontend/src/features/seeding/constants.ts`.
 */
export const SEEDING_TYPES = ['registered-deliveries'] as const;

export type SeedingType = (typeof SEEDING_TYPES)[number];

export const SEEDING_ENV_FLAG = 'ENABLE_SEEDING';

export function isSeedingEnabled(): boolean {
  return process.env[SEEDING_ENV_FLAG]?.trim().toLowerCase() === 'true';
}
