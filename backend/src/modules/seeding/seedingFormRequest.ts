import { z } from 'zod';
import { SEEDING_TYPES } from './seedingTypes';

const runSchema = z.object({
  type: z.enum(SEEDING_TYPES),
});

export type RunSeedingPayload = z.infer<typeof runSchema>;

export const SeedingFormRequest = {
  parseRun: (body: unknown): RunSeedingPayload => runSchema.parse(body),
};
