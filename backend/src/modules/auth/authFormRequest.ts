import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().trim().max(120).nullable().optional(),
  deviceName: z.string().trim().nullable().optional(),
  force: z.boolean().optional(),
});

const faceOptionsSchema = z.object({
  email: z.string().email(),
});

const faceRegisterVerifySchema = z.object({
  credential: z.object({
    response: z.object({
      clientDataJSON: z.string().min(1),
      attestationObject: z.string().min(1),
      transports: z.array(z.string()).optional(),
    }),
  }),
  deviceName: z.string().max(100).nullable().optional(),
});

const faceAuthVerifySchema = z.object({
  credential: z.object({
    id: z.string().min(1),
    rawId: z.string().optional(),
    response: z.object({
      clientDataJSON: z.string().min(1),
      authenticatorData: z.string().min(1),
      signature: z.string().min(1),
    }),
  }),
});

const operationalContextSchema = z.object({
  businessLocationId: z.string().min(1),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type FaceOptionsRequest = z.infer<typeof faceOptionsSchema>;
export type FaceRegisterVerifyRequest = z.infer<typeof faceRegisterVerifySchema>;
export type FaceAuthVerifyRequest = z.infer<typeof faceAuthVerifySchema>;
export type OperationalContextRequest = z.infer<typeof operationalContextSchema>;

function parseBearerToken(header: unknown): string | null {
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export const AuthFormRequest = {
  parseLogin: (body: unknown): LoginRequest => loginSchema.parse(body),
  parseFaceOptions: (body: unknown): FaceOptionsRequest => faceOptionsSchema.parse(body),
  parseFaceRegisterVerify: (body: unknown): FaceRegisterVerifyRequest => faceRegisterVerifySchema.parse(body),
  parseFaceAuthVerify: (body: unknown): FaceAuthVerifyRequest => faceAuthVerifySchema.parse(body),
  parseOperationalContext: (body: unknown): OperationalContextRequest => operationalContextSchema.parse(body),
  parseBearerToken,
};
