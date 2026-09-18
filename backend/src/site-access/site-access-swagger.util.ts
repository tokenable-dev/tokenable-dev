/** Swagger UI + OpenAPI spec — reachable without site-access cookie (GET only). */
export function isSwaggerPublicApiPath(path: string, method: string): boolean {
  if (method.toUpperCase() !== 'GET') return false;
  if (path === '/api/docs' || path === '/api/docs-json' || path === '/api/docs-yaml') {
    return true;
  }
  return path.startsWith('/api/docs/');
}
