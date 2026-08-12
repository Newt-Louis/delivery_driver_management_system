import crypto from 'crypto';
import { GoodsType, VehicleType } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { getRawAppConfig } from '../../services/appConfig';
import { domainError } from '../shared/domainError';

export type QuickRegistrationKind = 'PO' | 'CONSTRUCTION';

type ApiConfig = {
  endpoint: string;
  method: 'GET' | 'POST';
  payloadKeys: string[];
  authHeader?: string;
  codeKey?: string;
  payloadDefaults: Record<string, unknown>;
  siteLocationMap: Record<string, string>;
};

type NormalizedQuickRegistration = {
  kind: QuickRegistrationKind;
  orderCode: string;
  businessLocationId: string;
  businessLocationCode: string;
  businessLocationName: string;
  unitConfigId: string;
  receivingUnit: string;
  unitDisplayName: string;
  unitIcon: string | null;
  unitLogoUrl: string | null;
  goodsType: GoodsType;
  vehicleType: VehicleType;
  deliveryDate?: string;
  vendorCode?: string;
  vendorName?: string;
  title?: string;
  externalMessage?: string;
  verificationToken: string;
};

type QuickVerificationPayload = {
  kind: QuickRegistrationKind;
  orderCode: string;
  businessLocationId: string;
  unitConfigId: string;
  receivingUnit: string;
  goodsType: GoodsType;
  deliveryDate?: string;
};

const DEFAULT_SITE_LOCATION_MAP: Record<string, string> = {
  '1001': 'PVT',
  '1002': 'SALA',
  '1003': 'PHI',
  '2001': 'THT',
};

const PO_CONFIG_KEY = 'api.settings.po_verify';
const CONSTRUCTION_CONFIG_KEY = 'api.settings.thi_cong_verify';
const PO_CODE_KEY = 'EBELN';
const PO_DEFAULT_BUKRS = 'VN01';
const PO_UNIT_CODE = 'EMART';

const EMPTY_200_MESSAGE = 'Đã có lỗi trong quá trình kiểm tra, vui lòng liên hệ bộ phận phát triển';
const CONNECTIVITY_MESSAGE = 'Có lỗi kết nối với bên kiểm tra, vui lòng thông báo cho bộ phận liên quan';
const TOKEN_TTL_SECONDS = 15 * 60;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeText(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_-]+/g, '');
}

function stripCodeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, '');
}

function normalizePoCode(value: string): string {
  return stripCodeWhitespace(value).replace(/\D/g, '');
}

function normalizePoForPayload(value: string): string {
  return normalizePoCode(value);
}

function classifyCode(code: string): QuickRegistrationKind {
  const cleaned = stripCodeWhitespace(code);
  if (/^450\d{7}$/.test(cleaned)) return 'PO';
  if (/^[A-Za-z0-9]{5}$/.test(cleaned) && /[A-Za-z]/.test(cleaned) && /\d/.test(cleaned)) return 'CONSTRUCTION';
  throw domainError.badRequest('Mã PO cần có 10 chữ số và bắt đầu bằng 450, mã Thi Công gồm đúng 5 ký tự có cả chữ và số.');
}

function isEmptyObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return true;
  if (Array.isArray(value)) return value.length === 0;
  return Object.keys(value as Record<string, unknown>).length === 0;
}

async function readApiConfig(key: string): Promise<ApiConfig> {
  const raw = await getRawAppConfig(key);
  const endpoint = asString(raw.endpoint);
  if (!endpoint) {
    throw domainError.badRequest(`Chưa cấu hình API kiểm tra mã trong app_configs với key ${key}.`);
  }

  const auth = asRecord(raw.auth);
  const payloadDefaults = {
    ...asRecord(raw.payload),
    ...asRecord(raw.payload_defaults),
    ...asRecord(raw.payloadDefaults),
  };
  const siteLocationMap = {
    ...DEFAULT_SITE_LOCATION_MAP,
    ...asRecord(raw.site_location_map),
    ...asRecord(raw.siteLocationMap),
  };
  const method = raw.method === 'GET' ? 'GET' : 'POST';
  return {
    endpoint,
    method,
    payloadKeys: asStringArray(raw.payload_keys),
    authHeader: asString(auth.header),
    codeKey: asString(raw.code_key) ?? asString(raw.codeKey),
    payloadDefaults,
    siteLocationMap: Object.fromEntries(
      Object.entries(siteLocationMap)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([k, v]) => [String(k).trim(), v.trim().toUpperCase()]),
    ),
  };
}

function replaceTemplateValues(value: unknown, code: string): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/\{\{\s*code\s*\}\}/gi, code)
      .replace(/\{\{\s*orderCode\s*\}\}/gi, code)
      .replace(/\{\{\s*poNumber\s*\}\}/gi, code)
      .replace(/\{\{\s*constructionCode\s*\}\}/gi, code);
  }
  if (Array.isArray(value)) return value.map((item) => replaceTemplateValues(item, code));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => [k, replaceTemplateValues(v, code)]),
    );
  }
  return value;
}

function resolveCodeKey(config: ApiConfig, kind: QuickRegistrationKind): string {
  if (kind === 'PO') return PO_CODE_KEY;
  if (config.codeKey) return config.codeKey;
  const preferred = ['code', 'CODE', 'REG_CODE', 'registrationCode', 'constructionCode'];
  const found = preferred.find((key) => config.payloadKeys.includes(key));
  return found ?? config.payloadKeys[config.payloadKeys.length - 1] ?? 'code';
}

function buildPayload(config: ApiConfig, kind: QuickRegistrationKind, code: string): Record<string, unknown> {
  const requestCode = kind === 'PO' ? normalizePoForPayload(code) : stripCodeWhitespace(code);
  const payload = replaceTemplateValues(config.payloadDefaults, requestCode) as Record<string, unknown>;
  const codeKey = resolveCodeKey(config, kind);

  for (const key of config.payloadKeys) {
    if (payload[key] === undefined && key === codeKey) {
      payload[key] = requestCode;
    }
  }
  if (payload[codeKey] === undefined) {
    payload[codeKey] = requestCode;
  }
  if (kind === 'PO') {
    payload.BUKRS = PO_DEFAULT_BUKRS;
    payload[PO_CODE_KEY] = requestCode;
  }

  return payload;
}

function parseAuthHeader(header: string | undefined): { name: string; value: string } | null {
  if (!header) return null;
  const idx = header.indexOf(':');
  if (idx <= 0) return null;
  const name = header.slice(0, idx).trim();
  const value = header.slice(idx + 1).trim();
  return name && value ? { name, value } : null;
}

function redactSecret(value: string): string {
  if (value.length <= 8) return '*'.repeat(value.length);
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function callExternalApi(kind: QuickRegistrationKind, code: string): Promise<unknown> {
  const config = await readApiConfig(kind === 'PO' ? PO_CONFIG_KEY : CONSTRUCTION_CONFIG_KEY);
  const payload = buildPayload(config, kind, code);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const authHeader = parseAuthHeader(config.authHeader);
  if (authHeader) {
    headers[authHeader.name] = authHeader.value;
  }

  let url = config.endpoint;
  const init: RequestInit = { method: config.method, headers };
  if (config.method === 'GET') {
    const params = new URLSearchParams();
    Object.entries(payload).forEach(([key, value]) => {
      if (value !== undefined && value !== null) params.set(key, String(value));
    });
    url += url.includes('?') ? `&${params.toString()}` : `?${params.toString()}`;
  } else {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(payload);
  }

  console.log('[quick-register] External API request', {
    kind,
    method: config.method,
    url,
    payload,
    auth: authHeader
      ? { name: authHeader.name, value: redactSecret(authHeader.value), length: authHeader.value.length }
      : null,
  });

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    console.error('[quick-register] External API request failed', { kind, error });
    throw domainError.badRequest(CONNECTIVITY_MESSAGE, 'ExternalApiConnectionFailed');
  }

  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } else {
    body = {};
  }

  console.log('[quick-register] External API response', {
    kind,
    status: response.status,
    body,
  });

  if (response.status >= 500) {
    throw domainError.badRequest(CONNECTIVITY_MESSAGE, 'ExternalApiServerError');
  }
  if (response.status === 401 || response.status === 403) {
    throw domainError.badRequest('API kiểm tra từ chối xác thực. Vui lòng kiểm tra Authorization trong cấu hình API.', 'ExternalApiUnauthorized');
  }
  if (response.status >= 400) {
    throw domainError.notFound(kind === 'PO' ? 'Mã PO không tồn tại' : 'Mã Thi Công không tồn tại');
  }
  if (!response.ok) {
    throw domainError.badRequest('Không thể kiểm tra mã lúc này. Vui lòng thử lại sau.');
  }
  if (isEmptyObject(body)) {
    throw domainError.badRequest(EMPTY_200_MESSAGE, 'ExternalApiEmptyResponse');
  }

  return body;
}

function parsePoItem(body: unknown): Record<string, unknown> {
  const record = asRecord(body);
  const items = Array.isArray(record.ITEMS) ? record.ITEMS : [];
  return asRecord(items[0] ?? {});
}

function parseYyyyMmDd(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw || !/^\d{8}$/.test(raw)) return undefined;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function mapGoodsType(value: unknown, fallback: GoodsType): GoodsType {
  const normalized = normalizeText(asString(value) ?? '');
  if (!normalized) return fallback;
  if (normalized.includes('FRESH') || normalized.includes('TUOISONG') || normalized.includes('TUOITUOI')) return GoodsType.FRESH_FOOD;
  if (normalized.includes('AUTO') || normalized.includes('WAREHOUSE') || normalized.includes('KHO')) return GoodsType.AUTO_WAREHOUSE;
  if (normalized.includes('THICONG') || normalized.includes('CONSTRUCTION') || normalized.includes('FITOUT')) return GoodsType.THI_CONG;
  if (normalized.includes('GENERAL') || normalized.includes('NORMAL') || normalized.includes('HANGHOATHONGTHUONG')) return GoodsType.GENERAL_GOODS;
  return fallback;
}

function parseBooleanLike(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return undefined;
}

function mapPoGoodsType(item: Record<string, unknown>): GoodsType {
  const fresh = parseBooleanLike(item.FRESH);
  if (fresh === true) return GoodsType.FRESH_FOOD;
  if (fresh === false) return GoodsType.GENERAL_GOODS;
  return mapGoodsType(item.PLACEHOLDER_TYPE, GoodsType.FRESH_FOOD);
}

async function findBusinessLocationByCode(code: string) {
  const location = await prisma.businessLocation.findFirst({
    where: { code: code.trim().toUpperCase(), isActive: true },
    select: { id: true, code: true, locationName: true },
  });
  if (!location) {
    throw domainError.badRequest(`Không tìm thấy khu vực vận hành tương ứng mã ${code}.`);
  }
  return location;
}

async function findUnitConfig(args: {
  businessLocationId: string;
  unitMatcher: (unit: string) => boolean;
  missingMessage: string;
}) {
  const units = await prisma.unitConfig.findMany({
    where: { businessLocationId: args.businessLocationId, isActive: true },
    select: { id: true, unit: true, displayName: true, shortName: true, icon: true, logoUrl: true },
    orderBy: { unit: 'asc' },
  });
  const unit = units.find((item) => args.unitMatcher(item.unit));
  if (!unit) throw domainError.badRequest(args.missingMessage);
  return unit;
}

function signToken(payload: QuickVerificationPayload): string {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = { ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS };
  const encoded = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
  const secret = process.env.JWT_SECRET ?? 'fallback-secret';
  const sig = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyQuickRegistrationToken(token: string | undefined): QuickVerificationPayload | null {
  if (!token) return null;
  const [encoded, sig] = token.split('.');
  if (!encoded || !sig) return null;

  const secret = process.env.JWT_SECRET ?? 'fallback-secret';
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (Buffer.byteLength(sig) !== Buffer.byteLength(expected)) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  let payload: QuickVerificationPayload & { exp?: number };
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  if (!payload.orderCode || !payload.businessLocationId || !payload.unitConfigId || !payload.receivingUnit || !payload.goodsType) return null;
  return payload;
}

function withToken(data: Omit<NormalizedQuickRegistration, 'verificationToken'>): NormalizedQuickRegistration {
  return {
    ...data,
    verificationToken: signToken({
      kind: data.kind,
      orderCode: data.orderCode,
      businessLocationId: data.businessLocationId,
      unitConfigId: data.unitConfigId,
      receivingUnit: data.receivingUnit,
      goodsType: data.goodsType,
      deliveryDate: data.deliveryDate,
    }),
  };
}

async function normalizePo(code: string, body: unknown): Promise<NormalizedQuickRegistration> {
  const config = await readApiConfig(PO_CONFIG_KEY);
  const responseItem = parsePoItem(body);
  if (isEmptyObject(responseItem)) {
    throw domainError.badRequest(EMPTY_200_MESSAGE, 'PoItemsMissing');
  }
  const item: Record<string, unknown> = responseItem;
  const siteCode = asString(item.WERKS);
  const locationCode = siteCode ? config.siteLocationMap[siteCode] : undefined;
  if (!locationCode) {
    throw domainError.badRequest(EMPTY_200_MESSAGE, 'PoLocationMappingMissing');
  }

  const location = await findBusinessLocationByCode(locationCode);
  const unitConfig = await findUnitConfig({
    businessLocationId: location.id,
    unitMatcher: (unit) => normalizeText(unit) === normalizeText(PO_UNIT_CODE),
    missingMessage: `Không tìm thấy unit ${PO_UNIT_CODE} tại khu vực ${location.code}.`,
  });
  const deliveryDate = parseYyyyMmDd(item.EINDT);
  if (!deliveryDate) {
    throw domainError.badRequest(EMPTY_200_MESSAGE, 'PoDeliveryDateMissing');
  }

  return withToken({
    kind: 'PO',
    orderCode: normalizePoCode(code),
    businessLocationId: location.id,
    businessLocationCode: location.code,
    businessLocationName: location.locationName,
    unitConfigId: unitConfig.id,
    receivingUnit: unitConfig.unit,
    unitDisplayName: unitConfig.displayName || unitConfig.shortName || unitConfig.unit,
    unitIcon: unitConfig.icon,
    unitLogoUrl: unitConfig.logoUrl,
    goodsType: mapPoGoodsType(item),
    vehicleType: VehicleType.TRUCK,
    deliveryDate,
    vendorCode: asString(item.LIFNR),
    vendorName: asString(item.VENDORNA) ?? asString(item.PLACEHOLDER_VENDOR_NAME),
    externalMessage: asString(asRecord(body).LOG),
  });
}

function constructionUnitMatcher(input: string): (unit: string) => boolean {
  const normalized = normalizeText(input);
  const wantsThiskyHall = normalized.includes('THISKYHALL') || normalized.includes('THISKY');
  const wantsMall = normalized.includes('THISOMALL') || normalized.includes('MALL');
  return (unit) => {
    const dbUnit = normalizeText(unit);
    if (wantsThiskyHall && (dbUnit.includes('THISKYHALL') || dbUnit.includes('THISKY'))) return true;
    if (wantsMall && (dbUnit.includes('THISOMALL') || dbUnit === 'MALL' || dbUnit.includes('MALL'))) return true;
    return dbUnit === normalized || dbUnit.includes(normalized) || normalized.includes(dbUnit);
  };
}

async function normalizeConstruction(code: string, body: unknown): Promise<NormalizedQuickRegistration> {
  const record = asRecord(body);
  if (record.success === false) {
    throw domainError.badRequest(asString(record.message) ?? 'Mã Thi Công không hợp lệ');
  }

  const data = asRecord(record.data);
  if (isEmptyObject(data)) {
    throw domainError.badRequest(EMPTY_200_MESSAGE, 'ConstructionDataMissing');
  }
  const scope = asRecord(data.scope);
  const locationCode = asString(scope.location);
  const unitLabel = asString(scope.unit);
  if (!locationCode || !unitLabel) {
    throw domainError.badRequest(EMPTY_200_MESSAGE, 'ConstructionScopeMissing');
  }

  const location = await findBusinessLocationByCode(locationCode);
  const unitConfig = await findUnitConfig({
    businessLocationId: location.id,
    unitMatcher: constructionUnitMatcher(unitLabel),
    missingMessage: `Không tìm thấy unit tương ứng "${unitLabel}" tại khu vực ${location.code}.`,
  });
  const customer = asRecord(data.customer);

  return withToken({
    kind: 'CONSTRUCTION',
    orderCode: stripCodeWhitespace(code),
    businessLocationId: location.id,
    businessLocationCode: location.code,
    businessLocationName: location.locationName,
    unitConfigId: unitConfig.id,
    receivingUnit: unitConfig.unit,
    unitDisplayName: unitConfig.displayName || unitConfig.shortName || unitConfig.unit,
    unitIcon: unitConfig.icon,
    unitLogoUrl: unitConfig.logoUrl,
    goodsType: GoodsType.THI_CONG,
    vehicleType: VehicleType.TRUCK,
    vendorName: asString(customer.name),
    title: asString(data.name),
    externalMessage: asString(record.message),
  });
}

export async function verifyQuickRegistrationCode(inputCode: string): Promise<NormalizedQuickRegistration> {
  const code = stripCodeWhitespace(inputCode);
  if (!code) throw domainError.badRequest('Vui lòng nhập mã PO hoặc mã Thi Công.');

  const kind = classifyCode(code);
  const body = await callExternalApi(kind, code);
  if (kind === 'PO') return normalizePo(code, body);
  return normalizeConstruction(code, body);
}
