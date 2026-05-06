import type { KeywordMap } from './meta-schema.js'
import type { KeywordShape, MergeStrategy } from './types.js'

/**
 * Keywords whose merge semantics cannot be inferred from their shape alone.
 * These override the shape-based default.
 */
const _overrides = new Map<string, MergeStrategy>([
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
  ['$ref', 'fail-fast'],
  ['$dynamicRef', 'fail-fast'],
  ['$dynamicAnchor', 'fail-fast'],
  ['$anchor', 'fail-fast'],
  ['unevaluatedProperties', 'fail-fast'],
  ['unevaluatedItems', 'fail-fast'],
  ['if', 'fail-fast'],
  ['then', 'fail-fast'],
  ['else', 'fail-fast'],
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
