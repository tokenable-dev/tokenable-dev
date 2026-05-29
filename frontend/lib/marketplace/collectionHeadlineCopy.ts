export function formatPopulationHeadlineTag(raw: string): string {
  const t = raw.trim();
  const m = /^Pop\s*[·.:]\s*/i.exec(t);
  const num = m ? t.slice(m[0].length).trim() : t.replace(/^pop\s*/i, "").trim();
  return num ? `POP ${num}` : t;
}

export function buildHeadlineSubtitleLine(
  setLine: string | null | undefined,
  metaStrip: string | null | undefined,
  infoTags: { id: string; text: string }[] | null | undefined,
): string | null {
  const parts: string[] = [];
  const s = setLine?.trim();
  if (s) parts.push(s);
  const m = metaStrip?.trim();
  if (m) parts.push(m);
  const cardNo = infoTags?.find((t) => t.id === "cardno")?.text?.trim();
  if (cardNo) parts.push(cardNo);
  return parts.length > 0 ? parts.join(" | ") : null;
}

export function buildMobileHeadlineCopy(
  setLine: string | null | undefined,
  metaStrip: string | null | undefined,
  infoTags: { id: string; text: string }[] | null | undefined,
): { subtitleLine: string | null; cardNumber: string | null } {
  const parts: string[] = [];
  const s = setLine?.trim();
  if (s) parts.push(s);
  const m = metaStrip?.trim();
  if (m) parts.push(m);
  const cardNo = infoTags?.find((t) => t.id === "cardno")?.text?.trim() ?? null;
  return {
    subtitleLine: parts.length > 0 ? parts.join(" | ") : null,
    cardNumber: cardNo,
  };
}
