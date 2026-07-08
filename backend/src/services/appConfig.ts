import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getRedis } from './redis';

export const APP_CONFIG_KEYS = {
  staticIpAuth: 'auth.static_ip',
  faceIdAuth: 'auth.face_id',
  authSession: 'auth.session',
} as const;

export type StaticIpAuthConfig = {
  enabled: boolean;
  allowedIps: string[];
  allowedCidrs: string[];
  trustProxyHeader: boolean;
  roles: string[];
};

export type FaceIdAuthConfig = {
  enabled: boolean;
  rpName: string;
  rpId: string | null;
  origin: string | null;
  userVerification: 'required' | 'preferred' | 'discouraged';
  roles: string[];
  requireRegisteredCredential: boolean;
};

export type AuthSessionConfig = {
  tokenTtlMinutes: number;
  renewGraceMinutes: number;
  singleSessionPerUser: boolean;
};

const DEFAULT_STATIC_IP_AUTH: StaticIpAuthConfig = {
  enabled: false,
  allowedIps: [],
  allowedCidrs: [],
  trustProxyHeader: true,
  roles: ['ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN'],
};

const DEFAULT_FACE_ID_AUTH: FaceIdAuthConfig = {
  enabled: false,
  rpName: 'Delivery Driver Management',
  rpId: null,
  origin: null,
  userVerification: 'required',
  roles: ['ADMIN_LOC', 'ADMIN_OPE', 'RECEIVING', 'CHECKIN'],
  requireRegisteredCredential: false,
};

const DEFAULT_AUTH_SESSION: AuthSessionConfig = {
  tokenTtlMinutes: 480,
  renewGraceMinutes: 60,
  singleSessionPerUser: true,
};

function appConfigCacheKey(key: string): string {
  return `app-config:${key}`;
}

function appConfigCacheSeconds(): number {
  const raw = Number(process.env.APP_CONFIG_CACHE_SECONDS ?? 86400);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 86400;
}

function asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  return value.filter((item): item is string => typeof item === 'string');
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableString(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return typeof value === 'string' && value.trim() ? value : fallback;
}

async function getRawConfig(key: string): Promise<Record<string, unknown>> {
  const redis = await getRedis();
  const cached = await redis.get(appConfigCacheKey(key));
  if (cached) {
    try {
      return JSON.parse(cached) as Record<string, unknown>;
    } catch {
      await redis.del(appConfigCacheKey(key));
    }
  }

  const config = await prisma.appConfig.findUnique({
    where: { key },
    select: { value: true },
  });
  const value = asRecord(config?.value);
  await redis.set(appConfigCacheKey(key), JSON.stringify(value), { EX: appConfigCacheSeconds() });
  return value;
}

export async function invalidateAppConfigCache(key: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(appConfigCacheKey(key));
}

export async function refreshAppConfigCache(key: string): Promise<Record<string, unknown>> {
  await invalidateAppConfigCache(key);
  return getRawConfig(key);
}

export async function upsertAppConfigValue(args: {
  key: string;
  value: Prisma.InputJsonValue;
  category?: string;
  description?: string;
}): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: args.key },
    update: {
      value: args.value,
      ...(args.category !== undefined ? { category: args.category } : {}),
      ...(args.description !== undefined ? { description: args.description } : {}),
    },
    create: {
      key: args.key,
      value: args.value,
      category: args.category ?? 'system',
      description: args.description ?? '',
    },
  });
  await refreshAppConfigCache(args.key);
}

export async function getStaticIpAuthConfig(): Promise<StaticIpAuthConfig> {
  const value = await getRawConfig(APP_CONFIG_KEYS.staticIpAuth);
  return {
    enabled: asBoolean(value.enabled, DEFAULT_STATIC_IP_AUTH.enabled),
    allowedIps: asStringArray(value.allowedIps, DEFAULT_STATIC_IP_AUTH.allowedIps),
    allowedCidrs: asStringArray(value.allowedCidrs, DEFAULT_STATIC_IP_AUTH.allowedCidrs),
    trustProxyHeader: asBoolean(value.trustProxyHeader, DEFAULT_STATIC_IP_AUTH.trustProxyHeader),
    roles: asStringArray(value.roles, DEFAULT_STATIC_IP_AUTH.roles),
  };
}

export async function getFaceIdAuthConfig(): Promise<FaceIdAuthConfig> {
  const value = await getRawConfig(APP_CONFIG_KEYS.faceIdAuth);
  const userVerification = asString(value.userVerification, DEFAULT_FACE_ID_AUTH.userVerification);
  return {
    enabled: asBoolean(value.enabled, DEFAULT_FACE_ID_AUTH.enabled),
    rpName: asString(value.rpName, DEFAULT_FACE_ID_AUTH.rpName),
    rpId: asNullableString(value.rpId, DEFAULT_FACE_ID_AUTH.rpId),
    origin: asNullableString(value.origin, DEFAULT_FACE_ID_AUTH.origin),
    userVerification: ['required', 'preferred', 'discouraged'].includes(userVerification)
      ? userVerification as FaceIdAuthConfig['userVerification']
      : DEFAULT_FACE_ID_AUTH.userVerification,
    roles: asStringArray(value.roles, DEFAULT_FACE_ID_AUTH.roles),
    requireRegisteredCredential: asBoolean(
      value.requireRegisteredCredential,
      DEFAULT_FACE_ID_AUTH.requireRegisteredCredential,
    ),
  };
}

export async function getAuthSessionConfig(): Promise<AuthSessionConfig> {
  const value = await getRawConfig(APP_CONFIG_KEYS.authSession);
  const tokenTtlMinutes = asNumber(value.tokenTtlMinutes, DEFAULT_AUTH_SESSION.tokenTtlMinutes);
  const renewGraceMinutes = asNumber(value.renewGraceMinutes, DEFAULT_AUTH_SESSION.renewGraceMinutes);
  return {
    tokenTtlMinutes: Math.min(Math.max(Math.floor(tokenTtlMinutes), 5), 7 * 24 * 60),
    renewGraceMinutes: Math.min(Math.max(Math.floor(renewGraceMinutes), 0), 24 * 60),
    singleSessionPerUser: asBoolean(value.singleSessionPerUser, DEFAULT_AUTH_SESSION.singleSessionPerUser),
  };
}

export function roleIsConfigured(role: string, roles: string[]): boolean {
  return roles.length === 0 || roles.includes(role);
}
