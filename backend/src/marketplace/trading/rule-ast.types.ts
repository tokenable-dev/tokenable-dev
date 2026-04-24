export type RuleAstRoot = {
  type: 'AND' | 'OR';
  rules: RuleNode[];
};

export type RuleNode =
  | { type: 'COLLECTION_MATCH'; value: string }
  | { type: 'GRADE_MIN'; min: number }
  | { type: 'TRAIT_INCLUDE_ALL'; values: string[] }
  | { type: 'EXTERNAL_MATCH'; source: string; field?: string; value: string };

export function isRuleAstRoot(v: unknown): v is RuleAstRoot {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    (o.type === 'AND' || o.type === 'OR') &&
    Array.isArray(o.rules) &&
    o.rules.every((r) => r && typeof r === 'object' && typeof (r as RuleNode).type === 'string')
  );
}
