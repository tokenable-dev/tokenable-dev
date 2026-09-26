/**
 * Public vs owner cert display — card_naming_display_spec §7 / cert_number_masking_build_prompt.md
 *
 * Public: `#****{last4}` (four literal asterisks).
 * Owner: full digits (callers add `#` in UI if needed).
 * Unknown / too short: omit (return null).
 */

export function normalizePsaCertDigits(cert: string): string {
  return cert.replace(/\D/g, '');
}

/** Masked public label, e.g. `#****3749`. Returns null when cert cannot be masked. */
export function maskPsaCertNumberForPublicApi(
  cert: string | null | undefined,
): string | null {
  const digits = normalizePsaCertDigits(String(cert ?? '').trim());
  if (digits.length < 4) return null;
  return `#****${digits.slice(-4)}`;
}

function setCertOnGradedBranch(
  graded: Record<string, unknown>,
  masked: string,
): void {
  const psa =
    graded.psa && typeof graded.psa === 'object'
      ? ({ ...(graded.psa as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};
  psa.certNumber = masked;
  delete psa.certVerifyUrl;
  graded.psa = psa;

  const grade =
    graded.grade && typeof graded.grade === 'object'
      ? ({ ...(graded.grade as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : null;
  if (grade) {
    grade.certNumber = masked;
    graded.grade = grade;
  }

  const verification =
    graded.verification && typeof graded.verification === 'object'
      ? ({ ...(graded.verification as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : null;
  if (verification) {
    delete verification.certUrl;
    graded.verification = verification;
  }
}

const CERT_TRAIT_TYPES = new Set([
  'psa cert #',
  'cert number',
  'certification',
  'cert #',
]);

/**
 * Redact graded cert fields for non-owners. Mutates a shallow copy of metadata.
 * Full serial must not appear in API payloads for public/token-detail buyers.
 */
export function redactRwaMetadataCertForPublic(
  metadata: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!metadata) return null;

  const rawCert =
    (() => {
      const props = metadata.properties;
      const graded =
        props && typeof props === 'object'
          ? (props as Record<string, unknown>).graded
          : undefined;
      if (!graded || typeof graded !== 'object') return null;
      const g = graded as Record<string, unknown>;
      const psa =
        g.psa && typeof g.psa === 'object'
          ? (g.psa as Record<string, unknown>)
          : null;
      const grade =
        g.grade && typeof g.grade === 'object'
          ? (g.grade as Record<string, unknown>)
          : null;
      const fromPsa =
        typeof psa?.certNumber === 'string' ? psa.certNumber.trim() : '';
      const fromGrade =
        typeof grade?.certNumber === 'string' ? grade.certNumber.trim() : '';
      return fromPsa || fromGrade || null;
    })() ?? null;

  const masked = maskPsaCertNumberForPublicApi(rawCert);
  const out: Record<string, unknown> = { ...metadata };

  if (out.properties && typeof out.properties === 'object') {
    const props = { ...(out.properties as Record<string, unknown>) };
    if (props.graded && typeof props.graded === 'object') {
      const graded = { ...(props.graded as Record<string, unknown>) };
      if (masked) {
        setCertOnGradedBranch(graded, masked);
      } else {
        const psa =
          graded.psa && typeof graded.psa === 'object'
            ? ({ ...(graded.psa as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : null;
        if (psa) {
          delete psa.certNumber;
          delete psa.certVerifyUrl;
          graded.psa = psa;
        }
        const grade =
          graded.grade && typeof graded.grade === 'object'
            ? ({ ...(graded.grade as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : null;
        if (grade) {
          delete grade.certNumber;
          graded.grade = grade;
        }
      }
      props.graded = graded;
    }
    out.properties = props;
  }

  if (Array.isArray(out.attributes)) {
    out.attributes = out.attributes.map((a) => {
      if (!a || typeof a !== 'object') return a;
      const row = a as Record<string, unknown>;
      const trait = String(row.trait_type ?? '').trim().toLowerCase();
      if (!CERT_TRAIT_TYPES.has(trait)) return a;
      if (!masked) return null;
      return { ...row, value: masked };
    }).filter(Boolean);
  }

  return out;
}
