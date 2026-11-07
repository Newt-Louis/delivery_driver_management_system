import fs from 'node:fs';
import path from 'node:path';
import { domainError } from '../shared/domainError';

type Location = { id: string; code: string; locationName: string };
export type LocationCodeGroups = Map<string, string>;

function normalizeCode(value: string): string {
  return value.trim().toUpperCase();
}

export function parseLocationCodeGroups(value: unknown): LocationCodeGroups {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new Error('Danh mục mã khu vực phải là object JSON có ít nhất một nhóm.');
  }
  const aliases = new Map<string, string>();
  for (const [rawGroup, codes] of Object.entries(value)) {
    const group = normalizeCode(rawGroup);
    if (!group || !Array.isArray(codes)) throw new Error(`Nhóm mã khu vực không hợp lệ: ${rawGroup}`);
    for (const code of [rawGroup, ...codes]) {
      if (typeof code !== 'string' || !normalizeCode(code)) throw new Error(`Mã khu vực không hợp lệ trong nhóm ${rawGroup}.`);
      const alias = normalizeCode(code);
      const previous = aliases.get(alias);
      if (previous && previous !== group) throw new Error(`Mã khu vực ${alias} xuất hiện trong nhiều nhóm: ${previous}, ${group}.`);
      aliases.set(alias, group);
    }
  }
  return aliases;
}

export function locationGroupsFilePath(): string {
  const configured = process.env.LOCATION_CODE_GROUPS_FILE?.trim();
  return configured ? path.resolve(configured) : path.resolve(__dirname, '../../../../codeofconduct_location.json');
}

let cachedGroups: LocationCodeGroups | undefined;

export function loadLocationCodeGroups(): LocationCodeGroups {
  if (!cachedGroups) {
    const filePath = locationGroupsFilePath();
    try {
      cachedGroups = parseLocationCodeGroups(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } catch (error) {
      throw new Error(`Không thể tải danh mục mã khu vực tại ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return cachedGroups;
}

export function mapPoLocationCode(code: string, siteMap: Record<string, string>, groups: LocationCodeGroups): string {
  const source = normalizeCode(code);
  const mapped = siteMap[source];
  if (mapped === undefined) return source;
  const target = normalizeCode(mapped);
  if (!target) throw domainError.badRequest('Cấu hình mã khu vực SAP không hợp lệ. Vui lòng liên hệ bộ phận vận hành.', 'LocationMappingConflict');
  const sourceGroup = groups.get(source);
  if (sourceGroup && (groups.get(target) ?? target) !== sourceGroup) {
    throw domainError.badRequest('Cấu hình mã khu vực SAP không khớp với danh mục mã khu vực. Vui lòng liên hệ bộ phận vận hành.', 'LocationMappingConflict');
  }
  return target;
}

export function resolveLocationByCode(code: string, locations: Location[], groups: LocationCodeGroups): Location {
  const normalized = normalizeCode(code);
  const group = groups.get(normalized);
  const matches = locations.filter((location) => {
    const dbCode = normalizeCode(location.code);
    return group ? groups.get(dbCode) === group : dbCode === normalized;
  });
  if (matches.length === 0) throw domainError.badRequest(`Không tìm thấy khu vực vận hành tương ứng mã ${normalized}.`, 'LocationCodeNotFound');
  if (matches.length > 1) throw domainError.badRequest('Có nhiều khu vực đang hoạt động cùng nhóm mã. Vui lòng liên hệ bộ phận vận hành.', 'LocationCodeAmbiguous');
  return matches[0];
}
