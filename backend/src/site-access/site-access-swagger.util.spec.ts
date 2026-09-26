import { isSwaggerPublicApiPath } from './site-access-swagger.util';

describe('isSwaggerPublicApiPath', () => {
  it('allows swagger UI and spec GET routes', () => {
    expect(isSwaggerPublicApiPath('/api/docs', 'GET')).toBe(true);
    expect(isSwaggerPublicApiPath('/api/docs-json', 'GET')).toBe(true);
    expect(isSwaggerPublicApiPath('/api/docs/swagger-ui-bundle.js', 'GET')).toBe(
      true,
    );
  });

  it('blocks non-GET and API try-it-out paths', () => {
    expect(isSwaggerPublicApiPath('/api/docs', 'POST')).toBe(false);
    expect(isSwaggerPublicApiPath('/api/marketplace/collections', 'GET')).toBe(
      false,
    );
  });
});
