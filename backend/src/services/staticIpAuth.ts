import { Request } from 'express';
import { StaticIpAuthConfig } from './appConfig';

function normalizeIp(ip: string): string {
  const cleaned = ip.trim();
  if (cleaned.startsWith('::ffff:')) return cleaned.slice('::ffff:'.length);
  if (cleaned === '::1') return '127.0.0.1';
  return cleaned;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) return null;
  return nums.reduce((acc, num) => ((acc << 8) | num) >>> 0, 0);
}

function cidrContainsIp(cidr: string, ip: string): boolean {
  const [base, prefixRaw] = cidr.split('/');
  const prefix = Number(prefixRaw);
  const baseInt = ipv4ToInt(normalizeIp(base));
  const ipInt = ipv4ToInt(normalizeIp(ip));
  if (baseInt === null || ipInt === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (baseInt & mask) === (ipInt & mask);
}

export function getRequestIp(req: Request, trustProxyHeader: boolean): string {
  if (trustProxyHeader) {
    const forwardedFor = req.headers['x-forwarded-for'];
    const firstForwarded = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0];
    if (firstForwarded?.trim()) return normalizeIp(firstForwarded);

    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string' && realIp.trim()) return normalizeIp(realIp);
  }

  return normalizeIp(req.socket.remoteAddress ?? req.ip ?? '');
}

export function ipIsAllowedByConfig(ip: string, config: StaticIpAuthConfig): boolean {
  const normalized = normalizeIp(ip);
  if (!normalized) return false;

  if (config.allowedIps.map(normalizeIp).includes(normalized)) return true;
  return config.allowedCidrs.some((cidr) => cidrContainsIp(cidr, normalized));
}
