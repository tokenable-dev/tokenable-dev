/** NestJS / ValidationPipe error body → single line for UI. */
export function formatBackendErrorBody(
  body: unknown,
  status: number,
  fallback: string,
): string {
  if (!body || typeof body !== "object") {
    return `[${status}] ${fallback}`;
  }
  const o = body as Record<string, unknown>;
  const parts: string[] = [];
  const msg = o.message;
  if (Array.isArray(msg)) {
    parts.push(msg.map(String).join("; "));
  } else if (typeof msg === "string" && msg.trim()) {
    parts.push(msg.trim());
  }
  if (typeof o.error === "string" && o.error.trim() && o.error !== "Bad Request") {
    parts.push(o.error.trim());
  }
  const text = parts.length > 0 ? parts.join(" — ") : fallback;
  return `[${status}] ${text}`;
}

export async function readBackendErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const body = await res.json().catch(() => null);
  return formatBackendErrorBody(body, res.status, fallback);
}
