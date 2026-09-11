import {
  mapFedExRateError,
  mapFedExRateErrorFromResponse,
  mappedNoQuotesError,
  throwMappedFedExRateError,
  type FedExMappedRateError,
  type FedExRateErrorCategory,
  type FedExRateErrorCode,
} from './fedex-rate-errors';

describe('mapFedExRateError', () => {
  it('maps SYSTEM.UNEXPECTED to retryable', () => {
    const m = mapFedExRateError({
      fedexCode: 'SYSTEM.UNEXPECTED.ERROR',
      fedexMessage:
        'The system has experienced an unexpected problem and is unable to complete your request. Please try again later.',
      httpStatus: 500,
    });
    expect(m.code).toBe('FEDEX_RATE_RETRYABLE');
    expect(m.category).toBe('retryable');
    expect(m.httpStatus).toBe(503);
    expect(m.message).toMatch(/temporarily unavailable/i);
    expect(m.fedexCode).toBe('SYSTEM.UNEXPECTED.ERROR');
  });

  it('maps SERVICE.UNAVAILABLE to retryable', () => {
    const m = mapFedExRateError({
      fedexCode: 'SERVICE.UNAVAILABLE.ERROR',
      fedexMessage: 'The service is currently unavailable',
      httpStatus: 503,
    });
    expect(m.code).toBe('FEDEX_RATE_RETRYABLE');
  });

  it('maps ZIPCODE.NOTFOUND to invalid_address', () => {
    const m = mapFedExRateError({
      fedexCode: 'ENTERED.ZIPCODE.NOTFOUND',
      fedexMessage:
        'The state or province and ZIP or postal code entered was not found',
      httpStatus: 400,
    });
    expect(m.code).toBe('FEDEX_RATE_INVALID_ADDRESS');
    expect(m.category).toBe('invalid_address');
    expect(m.httpStatus).toBe(400);
  });

  it('maps packaging combination to unsupported_lane', () => {
    const m = mapFedExRateError({
      fedexCode: 'SHIPMENT.PACKAGING.INVALID',
      fedexMessage: 'Invalid service and packaging combination',
      httpStatus: 400,
    });
    expect(m.code).toBe('FEDEX_RATE_UNSUPPORTED_LANE');
  });

  it('maps account / oauth style errors to auth_config', () => {
    const m = mapFedExRateError({
      fedexCode: 'ACCOUNTNUMBER.MINIMUMLENGTH.REQUIRED',
      fedexMessage: 'Enter a valid 9-digit FedEx account number',
      httpStatus: 400,
    });
    expect(m.code).toBe('FEDEX_RATE_CONFIG');
    expect(m.category).toBe('auth_config');
  });

  it('preserves FedEx raw fields for logging', () => {
    const m = mapFedExRateErrorFromResponse({
      httpStatus: 500,
      body: {
        errors: [
          {
            code: 'SYSTEM.UNEXPECTED.ERROR',
            message: 'raw fedex text',
          },
        ],
      },
      originIso: 'US',
      destIso: 'SG',
    });
    expect(m.fedexCode).toBe('SYSTEM.UNEXPECTED.ERROR');
    expect(m.fedexMessage).toBe('raw fedex text');
  });
});

describe('mapped error body shape', () => {
  it('throwMappedFedExRateError uses BadRequest for address', () => {
    const mapped: FedExMappedRateError = {
      code: 'FEDEX_RATE_INVALID_ADDRESS' satisfies FedExRateErrorCode,
      category: 'invalid_address' satisfies FedExRateErrorCategory,
      message: 'friendly',
      fedexCode: 'X',
      fedexMessage: 'raw',
      httpStatus: 400,
    };
    try {
      throwMappedFedExRateError(mapped);
      fail('expected throw');
    } catch (e) {
      const res = (e as { getResponse: () => unknown }).getResponse();
      expect(res).toEqual({
        code: 'FEDEX_RATE_INVALID_ADDRESS',
        category: 'invalid_address',
        message: 'friendly',
      });
    }
  });

  it('mappedNoQuotesError is unsupported-style', () => {
    const m = mappedNoQuotesError('US', 'SG');
    expect(m.code).toBe('FEDEX_RATE_NO_QUOTES');
    expect(m.message).toContain('US→SG');
  });
});
