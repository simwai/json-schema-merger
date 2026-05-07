import { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
import { isPlainObject } from './guards.js'
import type { Schema } from './types.js'
import { DRAFT_2019_09, DRAFT_2020_12, DRAFT_7, SUPPORTED_DRAFTS } from './types.js'

const unsupportedKeywordsByDraft = new Map<string, ReadonlySet<string>>([
  [
    DRAFT_7,
    new Set([
      '$dynamicRef', '$dynamicAnchor', '$anchor',
      'unevaluatedProperties', 'unevaluatedItems',
    ]),
  ],
  [
    DRAFT_2019_09,
    new Set([
      '$dynamicRef', '$dynamicAnchor',
      'unevaluatedProperties', 'unevaluatedItems',
    ]),
  ],
  [
    DRAFT_2020_12,
    new Set([
      '$dynamicRef', '$dynamicAnchor', '$anchor',
      'unevaluatedProperties', 'unevaluatedItems',
      'not',
    ]),
  ],
])

function collectUnsupported(
  schema: Schema,
  unsupported: ReadonlySet<string>,
  path: string,
  found: string[]
): void {
  for (const [key, value] of Object.entries(schema)) {
    if (unsupported.has(key)) found.push(`${path} → "${key}"`)
    if (isPlainObject(value)) collectUnsupported(value as Schema, unsupported, `${path}.${key}`, found)
  }
}

export function runPreflight(a: Schema, b: Schema): void {
  const draftA = typeof a['$schema'] === 'string' ? a['$schema'] : undefined
  const draftB = typeof b['$schema'] === 'string' ? b['$schema'] : undefined

  if (draftA !== draftB) throw new DraftMismatchError(draftA, draftB)
  if (draftA === undefined || !SUPPORTED_DRAFTS.has(draftA)) throw new UnsupportedDraftError(draftA)

  const unsupported = unsupportedKeywordsByDraft.get(draftA)!
  const found: string[] = []
  collectUnsupported(a, unsupported, 'schema A', found)
  collectUnsupported(b, unsupported, 'schema B', found)

  if (found.length > 0) throw new UnsupportedKeywordError(found)
}
