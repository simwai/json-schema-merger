import { dedupeJsonArray } from './dedupe.js'
import { isPlainObject, toArray } from './guards.js'
import type { KeywordMap } from './meta-schema.js'
import { getStrategy } from './strategy.js'
import type { JsonObject, JsonValue, Schema } from './types.js'

function mergeObjectMap(
  left: JsonObject,
  right: JsonObject,
  keywordMap: KeywordMap,
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

function mergeValue(
  key: string,
  left: JsonValue | undefined,
  right: JsonValue,
  keywordMap: KeywordMap,
): JsonValue {
  if (left === undefined) return right

  const strategy = getStrategy(key, keywordMap)

  switch (strategy) {
    case 'append-array':
      return dedupeJsonArray([...toArray(left), ...toArray(right)])

    case 'merge-object':
      return isPlainObject(left) && isPlainObject(right)
        ? mergeObjectMap(left, right, keywordMap)
        : right

    case 'max-number':
      return typeof left === 'number' && typeof right === 'number'
        ? Math.max(left, right)
        : right

    case 'min-number':
      return typeof left === 'number' && typeof right === 'number'
        ? Math.min(left, right)
        : right

    // fail-fast is already caught in preflight — this is a safety net.
    case 'fail-fast':
    case 'overwrite':
      return right
  }
}

export function mergeSchemas(a: Schema, b: Schema, keywordMap: KeywordMap): Schema {
  const result: JsonObject = { ...a }

  for (const [key, rightValue] of Object.entries(b)) {
    result[key] = mergeValue(key, result[key], rightValue, keywordMap)
  }

  return result
}
