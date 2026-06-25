/**
 * OpenAPI server entries for Swagger UI "Try it out".
 * Relative `/` keeps requests on the same host (production, staging, local proxy).
 */
export function buildSwaggerServers(input: {
  port: number;
  isProduction: boolean;
  publicApiUrl?: string | null;
}): Array<{ url: string; description: string }> {
  const servers: Array<{ url: string; description: string }> = [];

  const explicit = input.publicApiUrl?.trim().replace(/\/$/, '');
  if (explicit) {
    servers.push({ url: explicit, description: '배포 API' });
  }

  servers.push({
    url: '/',
    description: explicit ? '현재 브라우저 호스트' : '현재 호스트 (권장)',
  });

  if (!input.isProduction) {
    servers.push({
      url: `http://localhost:${input.port}`,
      description: '로컬 Nest 직접',
    });
  }

  return servers;
}
