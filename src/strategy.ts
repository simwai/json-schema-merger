import type { KeywordMap } from './meta-schema.js'
import type { KeywordShape, MergeStrategy } from './types.js'

const lowerBoundKeywords: ReadonlyArray<string> = [
  'minimum', 'exclusiveMinimum', 'minLength', 'minItems', 'minProperties', 'minContains',
]

const upperBoundKeywords: ReadonlyArray<string> = [
  'maximum', 'exclusiveMaximum', 'maxLength', 'maxItems', 'maxProperties', 'maxContains',
]

const objectMapKeywords: ReadonlyArray<string> = [
  'properties', '$defs', 'definitions', 'patternProperties', 'dependentRequired',
]

const arrayUnionKeywords: ReadonlyArray<string> = [
  'type', 'allOf', 'anyOf', 'oneOf', 'prefixItems', 'items', 'enum', 'examples', 'required',
]

const failFastKeywords: ReadonlyArray<string> = [
  '$dynamicRef', '$dynamicAnchor', '$anchor',
  'unevaluatedProperties', 'unevaluatedItems',
  'not',
]

const strategyOverrides = new Map<string, MergeStrategy>([
  ...lowerBoundKeywords.map((k): [string, MergeStrategy] => [k, 'max-number']),
  ...upperBoundKeywords.map((k): [string, MergeStrategy] => [k, 'min-number']),
  ...objectMapKeywords.map((k): [string, MergeStrategy] => [k, 'merge-object']),
  ...arrayUnionKeywords.map((k): [string, MergeStrategy] => [k, 'append-array']),
  ...failFastKeywords.map((k): [string, MergeStrategy] => [k, 'fail-fast']),
])

function defaultStrategyForShape(shape: KeywordShape): MergeStrategy {
  if (shape === 'array') return 'append-array'
  if (shape === 'object') return 'merge-object'
  return 'overwrite'
}

export function getStrategy(key: string, keywordMap: KeywordMap): MergeStrategy {
  return strategyOverrides.get(key) ?? defaultStrategyForShape(keywordMap.get(key) ?? 'unknown')
}
