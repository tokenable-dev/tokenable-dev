import { Injectable } from '@nestjs/common';
import type { BidRuleContext, RuleEvalResult, TokenRuleView } from './token-rule-view';
import { isRuleAstRoot, type RuleAstRoot, type RuleNode } from './rule-ast.types';

@Injectable()
export class RuleEngineService {
  /**
   * Pure evaluation: no I/O. `now` injectable for tests.
   */
  isBidApplicable(
    bid: BidRuleContext,
    ruleJson: Record<string, unknown>,
    token: TokenRuleView,
    now: Date = new Date(),
  ): RuleEvalResult {
    if (bid.collectionKey !== token.collectionKey) {
      return { ok: false, reason: 'COLLECTION_MISMATCH' };
    }

    if (bid.expiresAt.getTime() < now.getTime()) {
      return { ok: false, reason: 'EXPIRED' };
    }

    if (bid.tokenId != null && bid.tokenId !== '') {
      if (bid.tokenId !== token.tokenId) {
        return { ok: false, reason: 'DIRECT_TOKEN_MISMATCH' };
      }
    }

    if (bid.snapshotId != null && token.snapshotId != null && bid.snapshotId !== token.snapshotId) {
      return { ok: false, reason: 'SNAPSHOT_MISMATCH' };
    }

    if (!isRuleAstRoot(ruleJson)) {
      return { ok: false, reason: 'INVALID_RULE_SCHEMA' };
    }

    return this.evaluateAst(ruleJson, token);
  }

  private evaluateAst(ast: RuleAstRoot, token: TokenRuleView): RuleEvalResult {
    const matcher = (r: RuleNode): RuleEvalResult => this.evalRuleNode(r, token);
    if (ast.type === 'AND') {
      const matched: string[] = [];
      for (const rule of ast.rules) {
        const res = matcher(rule as RuleNode);
        if (!res.ok) return res;
        matched.push((rule as RuleNode).type);
      }
      return { ok: true, reason: 'OK', matchedRuleTypes: matched };
    }
    for (const rule of ast.rules) {
      const res = matcher(rule as RuleNode);
      if (res.ok) {
        return { ok: true, reason: 'OK', matchedRuleTypes: [(rule as RuleNode).type] };
      }
    }
    return { ok: false, reason: 'OR_RULE_NO_BRANCH_MATCHED' };
  }

  private evalRuleNode(rule: RuleNode, token: TokenRuleView): RuleEvalResult {
    switch (rule.type) {
      case 'COLLECTION_MATCH':
        if (rule.value !== token.collectionKey) {
          return { ok: false, reason: 'RULE_COLLECTION_MISMATCH' };
        }
        return { ok: true, reason: 'OK', matchedRuleTypes: ['COLLECTION_MATCH'] };
      case 'GRADE_MIN': {
        if (token.grade == null || Number.isNaN(token.grade)) {
          return { ok: false, reason: 'GRADE_MISSING' };
        }
        if (token.grade < rule.min) {
          return { ok: false, reason: 'GRADE_TOO_LOW' };
        }
        return { ok: true, reason: 'OK', matchedRuleTypes: ['GRADE_MIN'] };
      }
      case 'TRAIT_INCLUDE_ALL': {
        const traits = token.traits ?? [];
        if (!rule.values.every((v) => traits.includes(v))) {
          return { ok: false, reason: 'TRAIT_MISMATCH' };
        }
        return { ok: true, reason: 'OK', matchedRuleTypes: ['TRAIT_INCLUDE_ALL'] };
      }
      case 'EXTERNAL_MATCH': {
        const ref = token.externalRef ?? {};
        const flatKey = rule.field ? `${rule.source}:${rule.field}` : rule.source;
        const actual = ref[flatKey] ?? ref[rule.source];
        if (actual !== rule.value) {
          return { ok: false, reason: 'EXTERNAL_MISMATCH' };
        }
        return { ok: true, reason: 'OK', matchedRuleTypes: ['EXTERNAL_MATCH'] };
      }
      default:
        return { ok: false, reason: 'UNKNOWN_RULE_TYPE' };
    }
  }
}
