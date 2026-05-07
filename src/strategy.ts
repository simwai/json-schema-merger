import type { KeywordMap } from './meta-schema.js'
import type { KeywordShape, MergeStrategy } from './types.js'

/**
 * Keywords whose merge semantics cannot be inferred from their shape alone,
 * OR where shape-based inference is unreliable (e.g. the meta-schema uses
 * anyOf/oneOf branches that the classifier resolves to 'unknown').
 * These always override shape-based defaults.
 */
const _overrides = new Map<string, MergeStrategy>([
  // Polymorphic — fixture shape is reliable but we pin it defensively.
  ['type', 'append-array'],

  // Object maps that must be merged key-by-key.
  ['properties', 'merge-object'],
  ['$defs', 'merge-object'],
  ['patternProperties', 'merge-object'],
  ['dependentRequired', 'merge-object'],

  // Composition arrays — union all entries.
  ['allOf', 'append-array'],
  ['anyOf', 'append-array'],
  ['oneOf', 'append-array'],
  ['prefixItems', 'append-array'],
  ['enum', 'append-array'],
  ['examples', 'append-array'],
  ['required', 'append-array'],

  // Numeric lower bounds — keep stricter (larger) value.
  ['minimum', 'max-number'],
  ['exclusiveMinimum', 'max-number'],
  ['minLength', 'max-number'],
  ['minItems', 'max-number'],
  ['minProperties', 'max-number'],
  ['minContains', 'max-number'],

  // Numeric upper bounds — keep stricter (smaller) value.
  ['maximum', 'min-number'],
  ['exclusiveMaximum', 'min-number'],
  ['maxLength', 'min-number'],
  ['maxItems', 'min-number'],
  ['maxProperties', 'min-number'],
  ['maxContains', 'min-number'],

  // Require evaluation-state or reference resolution — fail immediately.
  ['$dynamicRef', 'fail-fast'],
  ['$dynamicAnchor', 'fail-fast'],
  ['$anchor', 'fail-fast'],
  ['unevaluatedProperties', 'fail-fast'],
  ['unevaluatedItems', 'fail-fast'],
  ['not', 'fail-fast'],
])

function defaultStrategyForShape(shape: KeywordShape): MergeStrategy {
  switch (shape) {
    case 'array': return 'append-array'
    case 'object': return 'merge-object'
    default: return 'overwrite'
  }
}

export function getStrategy(key: string, keywordMap: KeywordMap): MergeStrategy {
  const override = _overrides.get(key)
  if (override !== undefined) return override

  const shape = keywordMap.get(key) ?? 'unknown'
  return defaultStrategyForShape(shape)
}
