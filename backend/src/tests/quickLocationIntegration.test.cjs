const assert = require('node:assert/strict');
const path = require('node:path');
const test = require('node:test');

test('PO and construction verification resolve location aliases and reject ambiguity', async (t) => {
  const prismaPath = require.resolve('../lib/prisma.ts');
  const configPath = require.resolve('../services/appConfig.ts');
  require(prismaPath);
  require(configPath);
  const oldPrisma = require.cache[prismaPath].exports;
  const oldConfig = require.cache[configPath].exports;
  const oldFetch = global.fetch;
  const oldFile = process.env.LOCATION_CODE_GROUPS_FILE;
  process.env.LOCATION_CODE_GROUPS_FILE = path.resolve(__dirname, '../../../codeofconduct_location.json');

  let locations = [{ id: 'location-sal', code: 'SAL', locationName: 'Sala' }];
  const units = [
    { id: 'emart', unit: 'EMART', displayName: 'Emart', shortName: '', icon: null, logoUrl: null },
    { id: 'hall', unit: 'THISKYHALL', displayName: 'Hall', shortName: '', icon: null, logoUrl: null },
  ];
  require.cache[prismaPath].exports = { prisma: {
    businessLocation: { findMany: async ({ where }) => { assert.equal(where.isActive, true); return locations; } },
    unitConfig: { findMany: async ({ where }) => { assert.equal(where.businessLocationId, 'location-sal'); return units; } },
  } };
  require.cache[configPath].exports = { getRawAppConfig: async (key) => ({
    endpoint: key === 'api.settings.po_verify' ? 'https://mock.invalid/po' : 'https://mock.invalid/construction',
    method: 'POST',
    site_location_map: { '1002': 'SALA' },
  }) };
  const { getVNDateKey } = require('../lib/dateVN.ts');
  let constructionDates = { approvedStartDate: getVNDateKey(), approvedEndDate: getVNDateKey(), approvedStartTime: '23:59:59', approvedEndTime: '00:00:00' };
  global.fetch = async (url) => ({ ok: true, status: 200, text: async () => JSON.stringify(
    url.endsWith('/po')
      ? { ITEMS: [{ WERKS: 1002, EINDT: getVNDateKey().replace(/-/g, ''), FRESH: true }] }
      : { success: true, data: { scope: { location: ' sala ', unit: 'THISKYHALL' }, goodsMovement: constructionDates } },
  ) });
  t.after(() => {
    require.cache[prismaPath].exports = oldPrisma;
    require.cache[configPath].exports = oldConfig;
    global.fetch = oldFetch;
    if (oldFile === undefined) delete process.env.LOCATION_CODE_GROUPS_FILE;
    else process.env.LOCATION_CODE_GROUPS_FILE = oldFile;
  });

  const { verifyQuickRegistrationCode, verifyQuickRegistrationToken } = require('../modules/deliveries/quickRegistrationService.ts');
  const po = await verifyQuickRegistrationCode('4500000001');
  assert.equal(po.businessLocationId, 'location-sal');
  assert.equal(po.businessLocationCode, 'SAL');
  assert.equal(po.unitConfigId, 'emart');
  assert.equal(verifyQuickRegistrationToken(po.verificationToken).businessLocationId, 'location-sal');
  const construction = await verifyQuickRegistrationCode('ABCDE');
  assert.equal(construction.businessLocationId, 'location-sal');
  assert.equal(construction.unitConfigId, 'hall');
  constructionDates = { approvedStartDate: '2000-01-01', approvedEndDate: '2000-01-02' };
  await assert.rejects(() => verifyQuickRegistrationCode('ABCDE'), { code: 'ConstructionDateNotToday' });
  constructionDates = { approvedStartDate: getVNDateKey(), approvedEndDate: getVNDateKey() };

  locations = [...locations, { id: 'location-sala', code: 'SALA', locationName: 'Duplicate' }];
  await assert.rejects(() => verifyQuickRegistrationCode('4500000001'), { code: 'LocationCodeAmbiguous' });
  await assert.rejects(() => verifyQuickRegistrationCode('ABCDE'), { code: 'LocationCodeAmbiguous' });
});
