const SERVICE_ERRORS = new Set([
  'ExternalApiConfigMissing', 'ExternalApiConnectionFailed', 'ExternalApiServerError',
  'ExternalApiUnauthorized', 'ExternalApiRequestFailed', 'ExternalApiEmptyResponse',
  'PoItemsMissing', 'PoLocationMappingMissing', 'PoDeliveryDateMissing',
  'ConstructionDataMissing', 'ConstructionScopeMissing',
]);

export function canOfferManualRegistration(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })?.response;
  return (typeof response?.status === 'number' && response.status >= 500 && response.status < 600)
    || (typeof response?.data?.error === 'string' && SERVICE_ERRORS.has(response.data.error));
}
