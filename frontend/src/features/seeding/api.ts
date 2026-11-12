import api from '../../lib/api';
import type { SeedingResult, SeedingType } from './types';

export async function runSeeding(type: SeedingType) {
  // A seeding run writes hundreds of rows; allow more time than regular calls.
  return (await api.post<SeedingResult>('/api/seeding/run', { type }, { timeout: 180_000 })).data;
}
