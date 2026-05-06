import { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
import { isPlainObject } from './guards.js'
import type { Schema } from './types.js'
import { SUPPORTED_DRAFT } from './types.js'

// Fail-fast keywords are defined in strategy.ts — mirror them here to avoid
// importing the full strategy module just for preflight.
const _failFastKeywords = new Set([
  '$ref', '$dynamicRef', '$dynamicAnchor', '$anchor',
  'unevaluatedProperties', 'unevaluatedItems',
  'if', 'then', 'else', 'not',
])

function collectUnsupported(schema: Schema, path: string, found: string[]): void {
  for (const [key, value] of Object.entries(schema)) {
    if (_failFastKeywords.has(key)) {
      found.push(`${path} → "${key}"`)
    }
    if (isPlainObject(value)) {
      collectUnsupported(value as Schema, `${path}.${key}`, found)
    }
  }
}

export function runPreflight(a: Schema, b: Schema): void {
  const draftA = typeof a['$schema'] === 'string' ? a['$schema'] : undefined
  const draftB = typeof b['$schema'] === 'string' ? b['$schema'] : undefined

  if (draftA !== draftB) throw new DraftMismatchError(draftA, draftB)
  if (draftA !== SUPPORTED_DRAFT) throw new UnsupportedDraftError(draftA)

  const unsupported: string[] = []
  collectUnsupported(a, 'schema A', unsupported)
  collectUnsupported(b, 'schema B', unsupported)

  if (unsupported.length > 0) throw new UnsupportedKeywordError(unsupported)
}
