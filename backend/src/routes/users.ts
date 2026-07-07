import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';
import { recordAuditLog, userActor } from '../services/auditLog';

const router = Router();

const SAFE_SELECT = {
  id: true, name: true, email: true,
  role: true, unit: true, department: true,
  businessLocationId: true,
  isActive: true, createdAt: true,
} as const;

const USER_ROLES = ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN'] as const;
const LOCATION_STAFF_ROLES = ['ADMIN_OPE', 'RECEIVING', 'CHECKIN'] as const;
const UNIT_REQUIRED_ROLES = ['RECEIVING', 'CHECKIN'] as const;
const UNIT_VALUES = ['EMART', 'THISKYHALL', 'TENANT'] as const;

const createSchema = z.object({
  name:       z.string().min(1).max(80),
  email:      z.string().email(),
  password:   z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role:       z.enum(USER_ROLES),
  unit:       z.enum(UNIT_VALUES).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  businessLocationId: z.string().trim().min(1).nullable().optional(),
});

const updateSchema = z.object({
  name:       z.string().min(1).max(80).optional(),
  role:       z.enum(USER_ROLES).optional(),
  unit:       z.enum(UNIT_VALUES).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  businessLocationId: z.string().trim().min(1).nullable().optional(),
  isActive:   z.boolean().optional(),
});

const resetPwSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

const locationStaffCreateSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().trim().email().nullable().optional(),
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role: z.enum(LOCATION_STAFF_ROLES),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
});

const locationStaffUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().trim().email().nullable().optional(),
  role: z.enum(LOCATION_STAFF_ROLES).optional(),
  unit: z.enum(UNIT_VALUES).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

async function assertBusinessLocationScope(role: string, businessLocationId: string | null | undefined) {
  if (role === 'SUPERADMIN') {
    if (businessLocationId) throw Object.assign(new Error('SUPERADMIN không gắn với BusinessLocation'), { statusCode: 400 });
    return null;
  }

  if (!businessLocationId) {
    throw Object.assign(new Error('Tài khoản không phải SUPERADMIN phải có BusinessLocation ID'), { statusCode: 400 });
  }

  const location = await prisma.businessLocation.findUnique({
    where: { id: businessLocationId },
    select: { id: true },
  });
  if (!location) {
    throw Object.assign(new Error('BusinessLocation không tồn tại'), { statusCode: 400 });
  }
  return businessLocationId;
}

async function assertUnitScope(role: string, unit: string | null | undefined, businessLocationId: string | null) {
  if (role === 'SUPERADMIN') return null;

  const normalizedUnit = unit ?? null;

  if ((UNIT_REQUIRED_ROLES as readonly string[]).includes(role) && !normalizedUnit) {
    throw Object.assign(new Error('Tài khoản RECEIVING và CHECKIN bắt buộc phải chọn đơn vị.'), { statusCode: 400 });
  }

  if (!normalizedUnit) return null;

  if (!businessLocationId) {
    throw Object.assign(new Error('Không thể gán đơn vị nếu tài khoản chưa thuộc BusinessLocation.'), { statusCode: 400 });
  }

  const unitConfig = await prisma.unitConfig.findUnique({
    where: {
      businessLocationId_unit: {
        businessLocationId,
        unit: normalizedUnit as never,
      },
    },
    select: { id: true },
  });

  if (!unitConfig) {
    throw Object.assign(new Error('Đơn vị không tồn tại trong BusinessLocation của tài khoản.'), { statusCode: 400 });
  }

  return normalizedUnit;
}

async function assertSingleSuperadmin(targetUserId?: string) {
  const exists = await prisma.user.findFirst({
    where: {
      role: 'SUPERADMIN',
      ...(targetUserId ? { id: { not: targetUserId } } : {}),
    },
    select: { id: true },
  });
  if (exists) {
    throw Object.assign(new Error('Hệ thống chỉ cho phép một tài khoản SUPERADMIN'), { statusCode: 409 });
  }
}

function requireLocationAdminScope(req: Request, res: Response): string | null {
  const businessLocationId = req.user?.businessLocationId;
  if (!businessLocationId) {
    res.status(403).json({ error: 'Tài khoản ADMIN_LOC chưa được gắn BusinessLocation.' });
    return null;
  }
  return businessLocationId;
}

function makeInternalEmail(role: string) {
  return `${role.toLowerCase()}.${randomUUID()}@internal.local`;
}

function normalizeOptionalEmail(email: string | null | undefined, role: string) {
  return email?.trim() || makeInternalEmail(role);
}

async function findScopedStaffOr404(id: string, businessLocationId: string) {
  return prisma.user.findFirst({
    where: {
      id,
      businessLocationId,
      role: { in: [...LOCATION_STAFF_ROLES] },
    },
    select: SAFE_SELECT,
  });
}

// GET /api/users/location-staff
router.get('/location-staff', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const businessLocationId = requireLocationAdminScope(req, res);
  if (!businessLocationId) return;

  const users = await prisma.user.findMany({
    where: {
      businessLocationId,
      role: { in: [...LOCATION_STAFF_ROLES] },
    },
    select: SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { unit: 'asc' }, { name: 'asc' }],
  });
  res.json(users);
}));

// POST /api/users/location-staff
router.post('/location-staff', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const businessLocationId = requireLocationAdminScope(req, res);
  if (!businessLocationId) return;
  const body = locationStaffCreateSchema.parse(req.body);
  const email = normalizeOptionalEmail(body.email, body.role);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) { res.status(409).json({ error: 'Email đã được sử dụng' }); return; }
  const unit = await assertUnitScope(body.role, body.unit ?? null, businessLocationId);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email,
      passwordHash,
      role: body.role,
      unit: unit as never,
      department: body.department ?? null,
      businessLocationId,
    },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'user.create',
    targetType: 'User',
    targetId: user.id,
    businessLocationId,
    after: { name: user.name, email: user.email, role: user.role, unit: user.unit, department: user.department },
  });
  res.status(201).json(user);
}));

// PATCH /api/users/location-staff/:id
router.patch('/location-staff/:id', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const businessLocationId = requireLocationAdminScope(req, res);
  if (!businessLocationId) return;
  const body = locationStaffUpdateSchema.parse(req.body);
  const existing = await findScopedStaffOr404(req.params.id, businessLocationId);
  if (!existing) { res.status(404).json({ error: 'Không tìm thấy nhân viên trong khu vực này' }); return; }

  if (body.email !== undefined && body.email) {
    const emailOwner = await prisma.user.findFirst({
      where: { email: body.email, id: { not: req.params.id } },
      select: { id: true },
    });
    if (emailOwner) { res.status(409).json({ error: 'Email đã được sử dụng' }); return; }
  }

  const nextRole = body.role ?? existing.role;
  const nextUnit = body.unit !== undefined ? body.unit : existing.unit;
  const unit = await assertUnitScope(nextRole, nextUnit ?? null, businessLocationId);
  const email = body.email !== undefined ? normalizeOptionalEmail(body.email, nextRole) : undefined;
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(body.name !== undefined && { name: body.name }),
      ...(body.role !== undefined && { role: body.role }),
      unit: unit as never,
      ...(body.department !== undefined && { department: body.department ?? null }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(email !== undefined && { email }),
      businessLocationId,
    },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'user.update',
    targetType: 'User',
    targetId: user.id,
    businessLocationId,
    before: { name: existing.name, email: existing.email, role: existing.role, unit: existing.unit, department: existing.department, isActive: existing.isActive },
    after: { name: user.name, email: user.email, role: user.role, unit: user.unit, department: user.department, isActive: user.isActive },
  });
  res.json(user);
}));

// PATCH /api/users/location-staff/:id/reset-password
router.patch('/location-staff/:id/reset-password', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const businessLocationId = requireLocationAdminScope(req, res);
  if (!businessLocationId) return;
  const { password } = resetPwSchema.parse(req.body);
  const existing = await findScopedStaffOr404(req.params.id, businessLocationId);
  if (!existing) { res.status(404).json({ error: 'Không tìm thấy nhân viên trong khu vực này' }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'user.reset_password',
    targetType: 'User',
    targetId: req.params.id,
    businessLocationId,
    after: { passwordReset: true },
  });
  res.json({ ok: true });
}));

// DELETE /api/users/location-staff/:id
router.delete('/location-staff/:id', authenticate, requireRole('ADMIN_LOC'), asyncHandler(async (req: Request, res: Response) => {
  const businessLocationId = requireLocationAdminScope(req, res);
  if (!businessLocationId) return;
  const existing = await findScopedStaffOr404(req.params.id, businessLocationId);
  if (!existing) { res.status(404).json({ error: 'Không tìm thấy nhân viên trong khu vực này' }); return; }

  const hasLogs = await prisma.deliveryHistoryEvent.count({ where: { actorId: req.params.id } });
  if (hasLogs > 0) {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: SAFE_SELECT,
    });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'user.deactivate',
      targetType: 'User',
      targetId: req.params.id,
      businessLocationId,
      before: { name: existing.name, email: existing.email, role: existing.role, isActive: existing.isActive },
      after: { name: user.name, email: user.email, role: user.role, isActive: user.isActive },
    });
    res.json({ deactivated: true, user });
  } else {
    await prisma.user.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'user.delete',
      targetType: 'User',
      targetId: req.params.id,
      businessLocationId,
      before: { name: existing.name, email: existing.email, role: existing.role },
    });
    res.json({ deleted: true });
  }
}));

// GET /api/users
router.get('/', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
  });
  res.json(users);
}));

// POST /api/users
router.post('/', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = createSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) { res.status(409).json({ error: 'Email đã được sử dụng' }); return; }
  if (body.role === 'SUPERADMIN') await assertSingleSuperadmin();
  const businessLocationId = await assertBusinessLocationScope(body.role, body.businessLocationId ?? null);
  const unit = await assertUnitScope(body.role, body.unit ?? null, businessLocationId);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role as never,
      unit: unit as never,
      department: body.department ?? null,
      businessLocationId,
    },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'user.create',
    targetType: 'User',
    targetId: user.id,
    businessLocationId,
    after: { name: user.name, email: user.email, role: user.role, unit: user.unit, department: user.department },
  });
  res.status(201).json(user);
}));

// PATCH /api/users/:id
router.patch('/:id', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = updateSchema.parse(req.body);
  const requesterId = (req as Request & { user?: { id: string } }).user?.id;
  const existing = await prisma.user.findUnique({ where: { id: req.params.id }, select: SAFE_SELECT });
  if (!existing) { res.status(404).json({ error: 'Không tìm thấy tài khoản' }); return; }

  // Prevent admin from deactivating their own account
  if (body.isActive === false && req.params.id === requesterId) {
    res.status(400).json({ error: 'Không thể vô hiệu hóa tài khoản của chính mình' }); return;
  }
  // Prevent changing the role of the current SUPERADMIN session
  if (body.role && body.role !== existing.role && req.params.id === requesterId) {
    res.status(400).json({ error: 'Không thể thay đổi quyền của tài khoản đang đăng nhập' }); return;
  }

  const nextRole = body.role ?? existing.role;
  const nextBusinessLocationId = body.businessLocationId !== undefined
    ? body.businessLocationId
    : existing.businessLocationId;
  if (nextRole === 'SUPERADMIN') await assertSingleSuperadmin(req.params.id);
  const businessLocationId = await assertBusinessLocationScope(nextRole, nextBusinessLocationId ?? null);
  const nextUnit = body.unit !== undefined ? body.unit : existing.unit;
  const unit = await assertUnitScope(nextRole, nextUnit ?? null, businessLocationId);

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(body.name       !== undefined && { name: body.name }),
      ...(body.role       !== undefined && { role: body.role as never }),
      unit: unit as never,
      ...(body.department !== undefined && { department: body.department ?? null }),
      businessLocationId,
      ...(body.isActive   !== undefined && { isActive: body.isActive }),
    },
    select: SAFE_SELECT,
  });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'user.update',
    targetType: 'User',
    targetId: user.id,
    businessLocationId,
    before: { name: existing.name, email: existing.email, role: existing.role, unit: existing.unit, department: existing.department, isActive: existing.isActive },
    after: { name: user.name, email: user.email, role: user.role, unit: user.unit, department: user.department, isActive: user.isActive },
  });
  res.json(user);
}));

// PATCH /api/users/:id/reset-password
router.patch('/:id/reset-password', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { password } = resetPwSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
  await recordAuditLog({
    ...userActor(req.user),
    action: 'user.reset_password',
    targetType: 'User',
    targetId: req.params.id,
    after: { passwordReset: true },
  });
  res.json({ ok: true });
}));

// DELETE /api/users/:id  (deactivates; hard-delete only if never used)
router.delete('/:id', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const requesterId = (req as Request & { user?: { id: string } }).user?.id;
  if (req.params.id === requesterId) {
    res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' }); return;
  }
  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
  if (!target) { res.status(404).json({ error: 'Không tìm thấy tài khoản' }); return; }
  if (target.role === 'SUPERADMIN') {
    res.status(400).json({ error: 'Không thể xóa tài khoản SUPERADMIN duy nhất' }); return;
  }
  const hasLogs = await prisma.deliveryHistoryEvent.count({ where: { actorId: req.params.id } });
  if (hasLogs > 0) {
    // Has history — deactivate instead of hard-delete
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: SAFE_SELECT,
    });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'user.deactivate',
      targetType: 'User',
      targetId: req.params.id,
      after: { name: u.name, email: u.email, role: u.role, isActive: u.isActive },
    });
    res.json({ deactivated: true, user: u });
  } else {
    const deletedUser = await prisma.user.findUnique({ where: { id: req.params.id }, select: SAFE_SELECT });
    await prisma.user.delete({ where: { id: req.params.id } });
    await recordAuditLog({
      ...userActor(req.user),
      action: 'user.delete',
      targetType: 'User',
      targetId: req.params.id,
      before: deletedUser ? { name: deletedUser.name, email: deletedUser.email, role: deletedUser.role } : undefined,
    });
    res.json({ deleted: true });
  }
}));

export default router;
