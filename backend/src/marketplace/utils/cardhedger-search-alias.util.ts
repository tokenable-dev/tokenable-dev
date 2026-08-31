/**
 * PSA / mint set abbreviations → extra Cardhedger search tokens and set-matching aliases.
 * Applies to all collections (not per-card hacks).
 */

function promoBlob(parts: string[]): string {
  return parts
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Extra lowercase tokens merged into set-matching pools in {@link scoreCard}. */
export function cardhedgerSetAliasTokens(
  cardSet: string,
  psaBrand: string | null,
): string[] {
  const blob = promoBlob([cardSet, psaBrand ?? '']);
  const tokens: string[] = [];
  const push = (s: string) => {
    const t = s.trim().toLowerCase();
    if (t.length >= 2) tokens.push(t);
  };

  if (/\b(svp|en-sv)\b/.test(blob) && /\b(black\s*star|promo)\b/.test(blob)) {
    push('scarlet violet black star promo');
    push('scarlet violet black star promos');
    push('pokemon scarlet violet');
  }
  if (/\b(swsh|sword\s*&?\s*shield)\b/.test(blob) && /\b(black\s*star|promo)\b/.test(blob)) {
    push('sword shield black star promo');
    push('pokemon swsh black star promo');
    push('pokemon sword shield');
  }
  if (/\b(mep|en-me)\b/.test(blob) && /\b(black\s*star|promo)\b/.test(blob)) {
    push('mega evolution promo');
    push('pokemon mega evolution promo');
    push('mega evolution');
  }
  if (/\bmega\s+evolution\b/.test(blob) && /\bpromo\b/.test(blob)) {
    push('mega evolution promo');
  }
  if (/\brookie\s+signatures?\b/.test(blob) && /\bprizm\b/.test(blob)) {
    push('panini prizm basketball');
    push('rookie signatures');
  }

  // PSA Brand `POKEMON JAPANESE SWORD & SHIELD EEVEE HEROES` vs Cardhedger
  // `2021 Pokemon Japanese Sword & Shield Eevee Heroes`.
  for (const src of [cardSet, psaBrand ?? '']) {
    const lower = src.trim().toLowerCase();
    if (!lower) continue;
    const noJa = lower.replace(/pokemon\s+japanese\s+/g, '').trim();
    if (noJa && noJa !== lower) push(noJa);
    if (/^[a-z0-9]{2,6}-/.test(lower.replace(/\s+/g, ''))) {
      const afterCode = lower.replace(/^[a-z0-9]{2,6}\s*-\s*/i, '').trim();
      if (afterCode.length >= 3) push(afterCode);
    }
  }
  if (/\beevee\s+heroes\b/.test(blob)) {
    push('eevee heroes');
    push('sword shield eevee heroes');
  }
  if (/\bsv2a\b/.test(blob) && /\b151\b/.test(blob)) {
    push('pokemon japanese 151');
    push('scarlet violet 151');
  }

  return tokens;
}

/** Additional `card-search` query strings (ordered after PSA-forward lines). */
export function cardhedgerExtraSearchQueries(q: {
  cardName: string;
  cardNumber: string;
  cardSet: string;
  psaBrand: string | null;
  psaSubject: string | null;
  psaVariety?: string | null;
  psaYear?: string | null;
}): string[] {
  const blob = promoBlob([
    q.cardSet,
    q.psaBrand ?? '',
    q.psaSubject ?? '',
    q.psaVariety ?? '',
    q.cardName,
  ]);
  const out: string[] = [];
  const push = (s: string) => {
    const t = s.trim();
    if (t.length >= 4) out.push(t);
  };
  const num = q.cardNumber.replace(/^#/, '').trim();
  const name = q.cardName.trim();
  const numPart = num ? `#${num.replace(/^0+/, '') || num}` : '';

  if (/\b(mep|en-me)\b/.test(blob) && /\b(black\s*star|promo)\b/.test(blob)) {
    push([name, numPart, 'pokemon mega evolution promo'].filter(Boolean).join(' '));
    push([name, numPart, 'mega evolution promo'].filter(Boolean).join(' '));
    push([name, num, 'mega evolution black star promo'].filter(Boolean).join(' '));
  }
  if (/\bultra[\s-]*premium\b/.test(blob) && /\b(mep|mega\s+evolution|promo)\b/.test(blob)) {
    push(
      [name, numPart, 'mega evolution promo ultra premium collection']
        .filter(Boolean)
        .join(' '),
    );
    push(
      [name, numPart, 'ultra premium collection mega evolution']
        .filter(Boolean)
        .join(' '),
    );
  }
  if (/\b(svp|en-sv)\b/.test(blob) && /\b(black\s*star|promo)\b/.test(blob)) {
    push(
      [name, numPart, 'pokemon scarlet violet black star promo']
        .filter(Boolean)
        .join(' '),
    );
    push(
      [name, numPart, 'scarlet violet black star promo'].filter(Boolean).join(' '),
    );
  }
  if (
    /\b(swsh|sword\s*&?\s*shield)\b/.test(blob) &&
    /\b(black\s*star|promo)\b/.test(blob)
  ) {
    push(
      [name, numPart, 'sword shield black star promo'].filter(Boolean).join(' '),
    );
    push(
      [name, numPart, 'pokemon swsh black star promo'].filter(Boolean).join(' '),
    );
    push(
      [name, numPart, 'pokemon sword shield black star promo']
        .filter(Boolean)
        .join(' '),
    );
    // include variety (e.g. "celebrations collection") in an alias as well
    if (q.psaVariety) {
      push(
        [name, numPart, 'sword shield black star promo', q.psaVariety]
          .filter(Boolean)
          .join(' '),
      );
    }
  }

  if (hintsLookLikePrizmRookieSignatures(q)) {
    const yearMatch = blob.match(/\b(20\d{2})\b/);
    const year = q.psaYear?.trim() || yearMatch?.[1] || '';
    push(
      [name, year, 'Panini Prizm Basketball Rookie Signatures', numPart]
        .filter(Boolean)
        .join(' '),
    );
    push(
      [name, 'Panini Prizm Basketball Rookie Signatures', numPart || num]
        .filter(Boolean)
        .join(' '),
    );
    push(
      [name, year, 'Panini Prizm Rookie Signatures', numPart || num]
        .filter(Boolean)
        .join(' '),
    );
  }

  return out;
}

export function hintsLookLikePrizmRookieSignatures(hints: {
  cardSet: string;
  psaBrand: string | null;
  psaVariety?: string | null;
}): boolean {
  const blob = promoBlob([
    hints.cardSet,
    hints.psaBrand ?? '',
    hints.psaVariety ?? '',
  ]);
  return /\brookie\s+signatures?\b/.test(blob) && /\bprizm\b/.test(blob);
}

export function hintsLookLikeSwshBlackStarPromo(hints: {
  cardSet: string;
  psaBrand: string | null;
}): boolean {
  const blob = promoBlob([hints.cardSet, hints.psaBrand ?? '']);
  return (
    /\b(swsh|sword\s*&?\s*shield)\b/.test(blob) &&
    /\b(black\s*star|promo)\b/.test(blob)
  );
}

export function hintsLookLikeMegaEvolutionPromo(hints: {
  cardSet: string;
  psaBrand: string | null;
  cardName: string;
}): boolean {
  const blob = promoBlob([hints.cardSet, hints.psaBrand ?? '', hints.cardName]);
  return (
    /\b(mep|en-me|mega\s+evolution)\b/.test(blob) &&
    /\b(black\s*star|promo)\b/.test(blob)
  );
}

export function hintsLookLikeSvBlackStarPromo(hints: {
  cardSet: string;
  psaBrand: string | null;
}): boolean {
  const blob = promoBlob([hints.cardSet, hints.psaBrand ?? '']);
  return (
    /\b(svp|en-sv|scarlet)\b/.test(blob) &&
    /\b(black\s*star|promo)\b/.test(blob)
  );
}
