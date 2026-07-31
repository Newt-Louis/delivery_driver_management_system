export type OrderCodeKind = 'PO' | 'TC';

const PO_CODES = [
  'PO0473829156',
  'PO5839102746',
  'PO1206847395',
  'PO7642059183',
  'PO3095718462',
  'PO9182746503',
  'PO4367091285',
  'PO8526173940',
  'PO6719304825',
  'PO2948571603',
  'PO7382046195',
  'PO5061938274',
  'PO1497280635',
  'PO6203849571',
  'PO9750316824',
  'PO3846501927',
  'PO8172640395',
  'PO2605197483',
  'PO5937462018',
  'PO0419285763',
] as const;

const TC_CODES = [
  'TC7391850246',
  'TC0284619573',
  'TC6159402837',
  'TC4827061395',
  'TC9503716284',
  'TC1674928053',
  'TC3049586172',
  'TC8261374905',
  'TC5902847163',
  'TC4716293508',
  'TC2385079461',
  'TC6843917520',
  'TC0195728463',
  'TC7528069143',
  'TC3961845207',
  'TC8472056319',
  'TC5209731684',
  'TC1746382950',
  'TC9084162735',
  'TC3617594820',
] as const;

const ORDER_CODE_SET = new Set<string>([...PO_CODES, ...TC_CODES]);

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function listMockOrderCodes(kind?: OrderCodeKind, search = '') {
  const q = normalizeCode(search);
  const all = [
    ...(kind !== 'TC' ? PO_CODES.map((code) => ({ code, kind: 'PO' as const })) : []),
    ...(kind !== 'PO' ? TC_CODES.map((code) => ({ code, kind: 'TC' as const })) : []),
  ];
  return q ? all.filter((item) => item.code.includes(q)) : all;
}

export function isKnownMockOrderCode(code: string): boolean {
  return ORDER_CODE_SET.has(normalizeCode(code));
}
