/** Permissive CSP for local `next dev` (Privy / wagmi / Turbopack HMR). */
export const DEV_CONTENT_SECURITY_POLICY = [
  "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "script-src * 'self' blob: data: https: http: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src * 'self' 'unsafe-inline'",
  "img-src * 'self' data: blob: https: http:",
  "font-src * 'self' data: https:",
  "connect-src * 'self' ws: wss: http: https: data: blob:",
  "worker-src * 'self' blob:",
  "frame-src * 'self' https: http:",
  "base-uri 'self'",
  "form-action * 'self' https: http:",
].join("; ");
