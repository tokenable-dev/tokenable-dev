/** Immutable snapshot passed into RuleEngineService (no DB access). */
export type TokenRuleView = {
  collectionKey: string;
  tokenId: string;
  grade: number | null;
  traits: string[];
  externalRef: Record<string, string>;
  snapshotId: string | null;
};

export type BidRuleContext = {
  collectionKey: string;
  expiresAt: Date;
  snapshotId: string | null;
  tokenId: string | null;
};

export type RuleEvalResult = {
  ok: boolean;
  reason: string;
  matchedRuleTypes?: string[];
};
