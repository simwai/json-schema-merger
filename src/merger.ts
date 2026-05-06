import { dedupeJsonArray } from './dedupe.js'
import { isPlainObject, toArray } from './guards.js'
import type { JsonObject, JsonValue, Schema } from './types.js'
import {
  ARRAY_UNION_KEYWORDS,
  LOWER_BOUND_KEYWORDS,
  OBJECT_MAP_KEYWORDS,
  UPPER_BOUND_KEYWORDS,
} from './types.js'

function mergeObjectMap(left: JsonObject, right: JsonObject): JsonObject {
  const result: JsonObject = { ...left }

  for (const [key, rightChild] of Object.entries(right)) {
    const leftChild = result[key]

    if (isPlainObject(leftChild) && isPlainObject(rightChild)) {
      result[key] = mergeSchemas(leftChild as Schema, rightChild as Schema)
    } else {
      result[key] = rightChild
    }
  }

  return result
}

function mergeValue(
  key: string,
  left: JsonValue | undefined,
  right: JsonValue,
): JsonValue {
  if (left === undefined) return right

  if (ARRAY_UNION_KEYWORDS.has(key)) {
    return dedupeJsonArray([...toArray(left), ...toArray(right)])
  }

  if (OBJECT_MAP_KEYWORDS.has(key)) {
    if (isPlainObject(left) && isPlainObject(right)) {
      return mergeObjectMap(left, right)
    }
    return right
  }

  if (LOWER_BOUND_KEYWORDS.has(key)) {
    if (typeof left === 'number' && typeof right === 'number') {
      return Math.max(left, right)
    }
    return right
  }

  if (UPPER_BOUND_KEYWORDS.has(key)) {
    if (typeof left === 'number' && typeof right === 'number') {
      return Math.min(left, right)
    }
    return right
  }

  // Default: last-writer-wins (scalars, prefixItems, items, additionalProperties, etc.)
  return right
}

export function mergeSchemas(a: Schema, b: Schema): Schema {
  const result: JsonObject = { ...a }

  for (const [key, rightValue] of Object.entries(b)) {
    result[key] = mergeValue(key, result[key], rightValue)
  }

  return result
}
