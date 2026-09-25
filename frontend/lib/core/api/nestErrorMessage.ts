/** NestJS default exception JSON (`message` may be string or validation array). */
export type NestErrorBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  code?: string;
};

export function messageFromNestErrorBody(
  body: NestErrorBody,
  fallback: string,
): string {
  const chunks: string[] = [];
  const msg = body.message;
  if (Array.isArray(msg)) {
    const joined = msg.map((s) => String(s).trim()).filter(Boolean).join('; ');
    if (joined) chunks.push(joined);
  } else if (typeof msg === 'string' && msg.trim()) {
    chunks.push(msg.trim());
  } else if (typeof body.error === 'string' && body.error.trim()) {
    chunks.push(body.error.trim());
  }
  if (chunks.length === 0) chunks.push(fallback);
  if (body.code && !chunks.some((c) => c.includes(body.code!))) {
    chunks.push(`(${body.code})`);
  }
  return chunks.join(' ');
}

export async function readNestErrorMessage(
  res: Response,
  fallback: string,
): Promise<{ message: string; code?: string; status: number }> {
  const status = res.status;
  const body = (await res.json().catch(() => ({}))) as NestErrorBody;
  const message = messageFromNestErrorBody(body, fallback);
  const code = typeof body.code === 'string' ? body.code : undefined;
  const withStatus =
    status >= 400
      ? `[HTTP ${status}] ${message}`
      : message;
  return { message: withStatus, code, status };
}
