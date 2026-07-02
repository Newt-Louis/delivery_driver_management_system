import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../lib/asyncHandler';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

const SAFE_SELECT = {
  id: true, name: true, email: true,
  role: true, unit: true, department: true,
  businessLocationId: true,
  isActive: true, createdAt: true,
} as const;

const USER_ROLES = ['SUPERADMIN', 'ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN'] as const;

const createSchema = z.object({
  name:       z.string().min(1).max(80),
  email:      z.string().email(),
  password:   z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role:       z.enum(USER_ROLES),
  unit:       z.enum(['EMART', 'THISKYHALL', 'TENANT']).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  businessLocationId: z.string().trim().min(1).nullable().optional(),
});

const updateSchema = z.object({
  name:       z.string().min(1).max(80).optional(),
  role:       z.enum(USER_ROLES).optional(),
  unit:       z.enum(['EMART', 'THISKYHALL', 'TENANT']).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  businessLocationId: z.string().trim().min(1).nullable().optional(),
  isActive:   z.boolean().optional(),
});

const resetPwSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
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

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role as never,
      unit: body.unit ?? null,
      department: body.department ?? null,
      businessLocationId,
    },
    select: SAFE_SELECT,
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

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(body.name       !== undefined && { name: body.name }),
      ...(body.role       !== undefined && { role: body.role as never }),
      ...(body.unit       !== undefined && { unit: body.unit ?? null }),
      ...(body.department !== undefined && { department: body.department ?? null }),
      businessLocationId,
      ...(body.isActive   !== undefined && { isActive: body.isActive }),
    },
    select: SAFE_SELECT,
  });
  res.json(user);
}));

// PATCH /api/users/:id/reset-password
router.patch('/:id/reset-password', authenticate, requireRole('SUPERADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { password } = resetPwSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
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
  const hasLogs = await prisma.callLog.count({ where: { calledByUserId: req.params.id } });
  if (hasLogs > 0) {
    // Has history — deactivate instead of hard-delete
    const u = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: false },
      select: SAFE_SELECT,
    });
    res.json({ deactivated: true, user: u });
  } else {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  }
}));

export default router;
