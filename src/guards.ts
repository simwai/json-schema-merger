import type { JsonObject, JsonValue } from './types.js'

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function toArray(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : [value]
}
