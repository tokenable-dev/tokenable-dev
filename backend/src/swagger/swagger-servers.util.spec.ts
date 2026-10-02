import { buildSwaggerServers } from './swagger-servers.util';

describe('buildSwaggerServers', () => {
  it('uses relative host first in production', () => {
    const servers = buildSwaggerServers({
      port: 4000,
      isProduction: true,
      publicApiUrl: null,
    });
    expect(servers[0]).toEqual({
      url: '/',
      description: '현재 호스트 (권장)',
    });
    expect(servers.some((s) => s.url.includes('localhost'))).toBe(false);
  });

  it('adds localhost in development', () => {
    const servers = buildSwaggerServers({
      port: 4100,
      isProduction: false,
      publicApiUrl: null,
    });
    expect(servers.some((s) => s.url === 'http://localhost:4100')).toBe(true);
  });

  it('prefers explicit PUBLIC_API_URL when set', () => {
    const servers = buildSwaggerServers({
      port: 4000,
      isProduction: true,
      publicApiUrl: 'https://tokenable-dev.com',
    });
    expect(servers[0].url).toBe('https://tokenable-dev.com');
    expect(servers[1].url).toBe('/');
  });
});
