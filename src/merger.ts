import { dedupeJsonArray } from './dedupe.js'
import { isPlainObject, toArray } from './guards.js'
import type { KeywordMap } from './meta-schema.js'
import { getStrategy } from './strategy.js'
import type { JsonObject, JsonValue, Schema } from './types.js'

function applyAppendArray(left: JsonValue, right: JsonValue): JsonValue {
  return dedupeJsonArray([...toArray(left), ...toArray(right)])
}

function applyMergeObject(
  left: JsonValue,
  right: JsonValue,
  keywordMap: KeywordMap
): JsonValue {
  if (!isPlainObject(left) || !isPlainObject(right)) return right
  return mergeChildSchemas(left, right, keywordMap)
}

function applyNumericBound(
  left: JsonValue,
  right: JsonValue,
  comparator: (a: number, b: number) => number
): JsonValue {
  return typeof left === 'number' && typeof right === 'number'
    ? comparator(left, right)
    : right
}

function mergeChildSchemas(
  left: JsonObject,
  right: JsonObject,
  keywordMap: KeywordMap
): JsonObject {
  const result: JsonObject = { ...left }

  for (const [key, rightChild] of Object.entries(right)) {
    const leftChild = result[key]
    result[key] =
      isPlainObject(leftChild) && isPlainObject(rightChild)
        ? mergeSchemas(leftChild as Schema, rightChild as Schema, keywordMap)
        : rightChild
  }

  return result
}

function mergeByStrategy(
  key: string,
  left: JsonValue | undefined,
  right: JsonValue,
  keywordMap: KeywordMap
): JsonValue {
  if (left === undefined) return right

  switch (getStrategy(key, keywordMap)) {
    case 'append-array': return applyAppendArray(left, right)
    case 'merge-object': return applyMergeObject(left, right, keywordMap)
    case 'max-number':   return applyNumericBound(left, right, Math.max)
    case 'min-number':   return applyNumericBound(left, right, Math.min)
    case 'fail-fast':
    case 'overwrite':    return right
  }
}

export function mergeSchemas(a: Schema, b: Schema, keywordMap: KeywordMap): Schema {
  const result: JsonObject = { ...a }
  for (const [key, rightValue] of Object.entries(b)) {
    result[key] = mergeByStrategy(key, result[key], rightValue, keywordMap)
  }
  return result
}
