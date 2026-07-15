export type KycStatusValue = 'none' | 'pending' | 'approved' | 'rejected';

export function mapSumsubReviewToKycStatus(
  reviewStatus: string | undefined,
  reviewAnswer: string | undefined,
): KycStatusValue | null {
  const status = reviewStatus?.trim().toLowerCase() ?? '';
  const answer = reviewAnswer?.trim().toUpperCase() ?? '';

  if (status === 'completed') {
    if (answer === 'GREEN') return 'approved';
    if (answer === 'RED') return 'rejected';
    return 'pending';
  }

  if (status === 'onhold' || status === 'on_hold') return 'pending';
  if (['init', 'pending', 'prechecked', 'queued'].includes(status)) {
    return 'pending';
  }

  return null;
}

export function shouldApplyKycTransition(
  current: KycStatusValue,
  next: KycStatusValue,
): boolean {
  if (current === next) return false;
  if (current === 'approved' && next === 'pending') return false;
  if (current === 'rejected' && next === 'pending') return true;
  return true;
}

export function extractSumsubRejectionReason(
  reviewResult: Record<string, unknown> | undefined,
): string | null {
  if (!reviewResult) return null;
  const labels = reviewResult.rejectLabels;
  if (Array.isArray(labels) && labels.length > 0) {
    return labels.map(String).join(', ');
  }
  const comment = reviewResult.moderationComment;
  if (typeof comment === 'string' && comment.trim()) return comment.trim();
  return null;
}
