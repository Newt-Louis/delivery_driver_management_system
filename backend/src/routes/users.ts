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
  isActive: true, createdAt: true,
} as const;

const createSchema = z.object({
  name:       z.string().min(1).max(80),
  email:      z.string().email(),
  password:   z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
  role:       z.enum(['ADMIN', 'RECEIVING', 'SECURITY', 'VENDOR']),
  unit:       z.enum(['EMART', 'THISKYHALL', 'TENANT']).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
});

const updateSchema = z.object({
  name:       z.string().min(1).max(80).optional(),
  role:       z.enum(['ADMIN', 'RECEIVING', 'SECURITY', 'VENDOR']).optional(),
  unit:       z.enum(['EMART', 'THISKYHALL', 'TENANT']).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  isActive:   z.boolean().optional(),
});

const resetPwSchema = z.object({
  password: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
});

// GET /api/users
router.get('/', authenticate, requireRole('ADMIN'), asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: SAFE_SELECT,
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
  });
  res.json(users);
}));

// POST /api/users
router.post('/', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = createSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) { res.status(409).json({ error: 'Email đã được sử dụng' }); return; }

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      name: body.name,
      email: body.email,
      passwordHash,
      role: body.role as never,
      unit: body.unit ?? null,
      department: body.department ?? null,
    },
    select: SAFE_SELECT,
  });
  res.status(201).json(user);
}));

// PATCH /api/users/:id
router.patch('/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const body = updateSchema.parse(req.body);
  const requesterId = (req as Request & { user?: { id: string } }).user?.id;

  // Prevent admin from deactivating their own account
  if (body.isActive === false && req.params.id === requesterId) {
    res.status(400).json({ error: 'Không thể vô hiệu hóa tài khoản của chính mình' }); return;
  }
  // Prevent demoting your own ADMIN role
  if (body.role && body.role !== 'ADMIN' && req.params.id === requesterId) {
    res.status(400).json({ error: 'Không thể thay đổi quyền của tài khoản đang đăng nhập' }); return;
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      ...(body.name       !== undefined && { name: body.name }),
      ...(body.role       !== undefined && { role: body.role as never }),
      ...(body.unit       !== undefined && { unit: body.unit ?? null }),
      ...(body.department !== undefined && { department: body.department ?? null }),
      ...(body.isActive   !== undefined && { isActive: body.isActive }),
    },
    select: SAFE_SELECT,
  });
  res.json(user);
}));

// PATCH /api/users/:id/reset-password
router.patch('/:id/reset-password', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const { password } = resetPwSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: req.params.id }, data: { passwordHash } });
  res.json({ ok: true });
}));

// DELETE /api/users/:id  (deactivates; hard-delete only if never used)
router.delete('/:id', authenticate, requireRole('ADMIN'), asyncHandler(async (req: Request, res: Response) => {
  const requesterId = (req as Request & { user?: { id: string } }).user?.id;
  if (req.params.id === requesterId) {
    res.status(400).json({ error: 'Không thể xóa tài khoản đang đăng nhập' }); return;
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
