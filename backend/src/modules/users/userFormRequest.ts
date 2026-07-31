import { z } from 'zod';

export const USER_ROLES = ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN'] as const;
export const LOCATION_STAFF_ROLES = ['ADMIN_OPE', 'RECEIVING', 'CHECKIN'] as const;
export const UNIT_REQUIRED_ROLES = ['RECEIVING', 'CHECKIN'] as const;
export const UNIT_VALUES = ['EMART', 'THISKYHALL', 'TENANT'] as const;

const createSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role: z.enum(USER_ROLES),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  unitConfigIds: z.array(z.string().min(1)).optional(),
  department: z.string().max(100).nullable().optional(),
  businessLocationId: z.string().trim().min(1).nullable().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  role: z.enum(USER_ROLES).optional(),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  unitConfigIds: z.array(z.string().min(1)).optional(),
  department: z.string().max(100).nullable().optional(),
  businessLocationId: z.string().trim().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

const locationStaffCreateSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().trim().email().nullable().optional(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role: z.enum(LOCATION_STAFF_ROLES),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  unitConfigIds: z.array(z.string().min(1)).optional(),
  department: z.string().max(100).nullable().optional(),
});

const locationStaffUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().trim().email().nullable().optional(),
  role: z.enum(LOCATION_STAFF_ROLES).optional(),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  unitConfigIds: z.array(z.string().min(1)).optional(),
  department: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type CreateUserPayload = z.infer<typeof createSchema>;
export type UpdateUserPayload = z.infer<typeof updateSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordSchema>;
export type LocationStaffCreatePayload = z.infer<typeof locationStaffCreateSchema>;
export type LocationStaffUpdatePayload = z.infer<typeof locationStaffUpdateSchema>;

export const UserFormRequest = {
  parseCreate: (body: unknown): CreateUserPayload => createSchema.parse(body),
  parseUpdate: (body: unknown): UpdateUserPayload => updateSchema.parse(body),
  parseResetPassword: (body: unknown): ResetPasswordPayload => resetPasswordSchema.parse(body),
  parseLocationStaffCreate: (body: unknown): LocationStaffCreatePayload => locationStaffCreateSchema.parse(body),
  parseLocationStaffUpdate: (body: unknown): LocationStaffUpdatePayload => locationStaffUpdateSchema.parse(body),
};
