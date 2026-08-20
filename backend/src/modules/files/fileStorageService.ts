import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { UploadedFileCategory, UploadedFileScope, Prisma } from '@prisma/client';
import type { AuthUser } from '../../middleware/auth';
import { prisma } from '../../lib/prisma';
import { domainError } from '../shared/domainError';
import type { FileUploadPayload } from './fileFormRequest';

const PUBLIC_UPLOAD_PREFIX = '/datafile/uploads';
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

function projectRoot() {
  const cwd = process.cwd();
  return path.basename(cwd) === 'backend' ? path.resolve(cwd, '..') : cwd;
}

export function getDatafileRoot() {
  const configured = process.env.DATAFILE_ROOT?.trim();
  if (!configured) return path.resolve(projectRoot(), 'datafile');
  return path.isAbsolute(configured) ? configured : path.resolve(projectRoot(), configured);
}

export function getUploadsDirectory() {
  return path.join(getDatafileRoot(), 'uploads');
}

export function getTmpDirectory() {
  return path.join(getDatafileRoot(), 'tmp');
}

export async function ensureDatafileRoot() {
  await Promise.all([
    fs.mkdir(getTmpDirectory(), { recursive: true }),
    fs.mkdir(getUploadsDirectory(), { recursive: true }),
    fs.mkdir(path.join(getDatafileRoot(), 'templates'), { recursive: true }),
  ]);
}

export async function ensureLocationUploadDirectory(locationCode: string) {
  await ensureDatafileRoot();
  await fs.mkdir(path.join(getUploadsDirectory(), slugSegment(locationCode, 'location')), { recursive: true });
}

export async function ensureUnitUploadDirectory(locationCode: string, unitCode: string) {
  await ensureLocationUploadDirectory(locationCode);
  await fs.mkdir(path.join(getUploadsDirectory(), slugSegment(locationCode, 'location'), slugSegment(unitCode, 'unit')), { recursive: true });
}

export function getMaxUploadBytes() {
  const configured = Number(process.env.DATAFILE_MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : 100 * 1024 * 1024;
}

function slugSegment(value: string | null | undefined, fallback: string) {
  const normalized = (value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function extensionFor(originalName: string | undefined, mimeType: string) {
  const originalExt = originalName?.split('.').pop()?.toLowerCase();
  if (originalExt && /^[a-z0-9]{1,8}$/.test(originalExt)) return originalExt;
  return MIME_EXTENSION[mimeType] ?? 'bin';
}

function safeStoredName(originalName: string | undefined, mimeType: string) {
  const ext = extensionFor(originalName, mimeType);
  const rawBase = originalName ? originalName.replace(/\.[^.]+$/, '') : 'file';
  const base = slugSegment(rawBase, 'file').slice(0, 60);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = crypto.randomBytes(4).toString('hex');
  return `${stamp}-${random}-${base}.${ext}`;
}

function assertUploadAllowed(category: UploadedFileCategory, mimeType: string, sizeBytes: number) {
  if (sizeBytes <= 0) throw domainError.badRequest('File upload đang rỗng.');
  if (sizeBytes > getMaxUploadBytes()) {
    throw domainError.badRequest(`File quá lớn. Giới hạn hiện tại là ${Math.floor(getMaxUploadBytes() / 1024 / 1024)}MB.`);
  }
  if ((category === UploadedFileCategory.LOGO || category === UploadedFileCategory.AVATAR) && !IMAGE_MIME_TYPES.has(mimeType)) {
    throw domainError.badRequest('Logo/avatar chỉ hỗ trợ PNG, JPG, WebP hoặc GIF.');
  }
}

async function resolveTarget(body: FileUploadPayload, actor: AuthUser | undefined) {
  if (body.scope === UploadedFileScope.UNIT_CONFIG) {
    if (!body.unitConfigId) throw domainError.badRequest('Thiếu unitConfigId cho file thuộc đơn vị.');
    const unit = await prisma.unitConfig.findUnique({
      where: { id: body.unitConfigId },
      include: { businessLocation: { select: { id: true, code: true } } },
    });
    if (!unit) throw domainError.notFound('UnitConfig không tồn tại.');
    assertCanUpload(actor, unit.businessLocationId);
    return {
      businessLocationId: unit.businessLocationId,
      unitConfigId: unit.id,
      locationCode: unit.businessLocation.code,
      unitCode: unit.unit,
    };
  }

  if (!body.businessLocationId) throw domainError.badRequest('Thiếu businessLocationId cho file thuộc khu vực.');
  const location = await prisma.businessLocation.findUnique({
    where: { id: body.businessLocationId },
    select: { id: true, code: true },
  });
  if (!location) throw domainError.notFound('BusinessLocation không tồn tại.');
  assertCanUpload(actor, location.id);
  return {
    businessLocationId: location.id,
    unitConfigId: null,
    locationCode: location.code,
    unitCode: null,
  };
}

function assertCanUpload(actor: AuthUser | undefined, businessLocationId: string) {
  if (!actor) throw domainError.unauthorized();
  if (actor.role === 'SUPERADMIN') return;
  if (actor.role === 'ADMIN_LOC' && actor.businessLocationId === businessLocationId) return;
  throw domainError.forbidden('Bạn không có quyền upload file cho khu vực này.');
}

export async function uploadFile(body: FileUploadPayload, actor: AuthUser | undefined) {
  let finalPath: string | null = null;
  try {
  await ensureDatafileRoot();
  const category = body.category as UploadedFileCategory;
  const scope = body.scope as UploadedFileScope;
  const target = await resolveTarget(body, actor);
  const mimeType = body.mimeType.toLowerCase();
  assertUploadAllowed(category, mimeType, body.sizeBytes);

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const locationSegment = slugSegment(target.locationCode, 'location');
  const unitSegment = target.unitCode ? slugSegment(target.unitCode, 'unit') : null;
  const storedName = safeStoredName(body.originalName, mimeType);
  const pathSegments = unitSegment
    ? ['uploads', locationSegment, unitSegment, yyyy, mm, dd, storedName]
    : ['uploads', locationSegment, yyyy, mm, dd, storedName];
  const relativePath = pathSegments.join('/');
  const absolutePath = path.join(getDatafileRoot(), ...pathSegments);
  finalPath = absolutePath;

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.rename(body.tempFilePath, absolutePath);

  const publicUrl = `${PUBLIC_UPLOAD_PREFIX}/${relativePath.slice('uploads/'.length)}`;
  try {
    return await prisma.uploadedFile.create({
    data: {
      scope,
      category,
      businessLocationId: target.businessLocationId,
      unitConfigId: target.unitConfigId,
      uploadedById: actor?.id,
      originalName: body.originalName || storedName,
      storedName,
      mimeType,
      sizeBytes: body.sizeBytes,
      relativePath,
      publicUrl,
      checksumSha256: body.checksumSha256,
      metadata: body.metadata ? (body.metadata as Prisma.InputJsonObject) : undefined,
    },
  });
  } catch (error) {
    await fs.unlink(absolutePath).catch(() => {});
    throw error;
  }
  } catch (error) {
    await fs.unlink(body.tempFilePath).catch(() => {});
    if (finalPath) await fs.unlink(finalPath).catch(() => {});
    throw error;
  }
}
