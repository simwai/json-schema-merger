import { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
import { isPlainObject } from './guards.js'
import type { Schema } from './types.js'
import { SUPPORTED_DRAFTS } from './types.js'

// Keywords unsupported across all drafts
const _alwaysUnsupported = new Set(['$dynamicRef', '$dynamicAnchor', '$anchor', 'not'])

// Per-draft additional unsupported keywords (on top of _alwaysUnsupported)
const _draftUnsupported = new Map<string, ReadonlySet<string>>([
  [
    'https://json-schema.org/draft/2020-12/schema',
    new Set(['unevaluatedProperties', 'unevaluatedItems']),
  ],
  [
    'https://json-schema.org/draft/2019-09/schema',
    new Set(['unevaluatedProperties', 'unevaluatedItems', '$recursiveRef', '$recursiveAnchor']),
  ],
  // Draft 7 has no additional unsupported keywords beyond the always-unsupported set
  ['https://json-schema.org/draft-07/schema', new Set<string>()],
  ['http://json-schema.org/draft-07/schema#', new Set<string>()],
])

function unsupportedKeywordsForDraft(draftUri: string): ReadonlySet<string> {
  const extra = _draftUnsupported.get(draftUri) ?? new Set<string>()
  return new Set([..._alwaysUnsupported, ...extra])
}

function collectUnsupported(
  schema: Schema,
  path: string,
  unsupported: ReadonlySet<string>,
  found: string[]
): void {
  for (const [key, value] of Object.entries(schema)) {
    if (unsupported.has(key)) found.push(`${path} → "${key}"`)
    if (isPlainObject(value)) collectUnsupported(value as Schema, `${path}.${key}`, unsupported, found)
  }
}

export function runPreflight(a: Schema, b: Schema): void {
  const draftA = typeof a['$schema'] === 'string' ? a['$schema'] : undefined
  const draftB = typeof b['$schema'] === 'string' ? b['$schema'] : undefined

  if (draftA !== draftB) throw new DraftMismatchError(draftA, draftB)
  if (draftA === undefined || !SUPPORTED_DRAFTS.has(draftA)) throw new UnsupportedDraftError(draftA)

  const unsupported = unsupportedKeywordsForDraft(draftA)
  const found: string[] = []
  collectUnsupported(a, 'schema A', unsupported, found)
  collectUnsupported(b, 'schema B', unsupported, found)

  if (found.length > 0) throw new UnsupportedKeywordError(found)
}
