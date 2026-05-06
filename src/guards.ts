import type { JsonObject, JsonValue } from './types.js'

export function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isJsonPrimitive(value: JsonValue): value is string | number | boolean | null {
  return value === null || typeof value !== 'object'
}

export function toArray(value: JsonValue): JsonValue[] {
  return Array.isArray(value) ? value : [value]
}
