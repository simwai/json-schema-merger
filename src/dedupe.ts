import type { JsonValue } from './types.js'

export function dedupeJsonArray(values: JsonValue[]): JsonValue[] {
  const seen = new Set<string>()
  const result: JsonValue[] = []

  for (const value of values) {
    const fingerprint = JSON.stringify(value)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    result.push(value)
  }

  return result
}
