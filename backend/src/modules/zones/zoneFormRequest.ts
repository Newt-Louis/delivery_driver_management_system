import { z } from 'zod';

const zoneSchema = z.object({
  code: z.string().min(1).max(10).toUpperCase(),
  name: z.string().min(1).max(100),
  unitConfigId: z.string().min(1),
});

export type ZonePayload = z.infer<typeof zoneSchema>;
export type ZoneUpdatePayload = Partial<ZonePayload>;

export const ZoneFormRequest = {
  parseCreate: (body: unknown): ZonePayload => zoneSchema.parse(body),
  parseUpdate: (body: unknown): ZoneUpdatePayload => zoneSchema.partial().parse(body),
};
