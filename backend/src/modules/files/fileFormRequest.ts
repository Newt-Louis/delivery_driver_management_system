import { z } from 'zod';

const uploadedFileScope = z.enum(['BUSINESS_LOCATION', 'UNIT_CONFIG']);
const uploadedFileCategory = z.enum(['LOGO', 'AVATAR', 'DOCUMENT', 'TEMPLATE', 'TMP', 'OTHER']);

const uploadSchema = z.object({
  scope: uploadedFileScope,
  category: uploadedFileCategory.default('OTHER'),
  businessLocationId: z.string().min(1).optional(),
  unitConfigId: z.string().min(1).optional(),
  originalName: z.string().trim().max(180).optional(),
  tempFilePath: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string().min(64).max(64),
  metadata: z.record(z.unknown()).optional(),
});

export type FileUploadPayload = z.infer<typeof uploadSchema>;

export const FileFormRequest = {
  parseUpload(body: unknown): FileUploadPayload {
    return uploadSchema.parse(body);
  },
};
