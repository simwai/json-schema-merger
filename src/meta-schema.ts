import got from 'got'
import { isPlainObject } from './guards.js'
import type { KeywordShape } from './types.js'

export type KeywordMap = Map<string, KeywordShape>

// Singleton cache: one entry per draft URI fetched in this process.
const _cache = new Map<string, KeywordMap>()

function classifyShape(definition: unknown): KeywordShape {
  if (!isPlainObject(definition)) return 'unknown'

  const type = definition['type']

  if (type === 'array') return 'array'
  if (type === 'object') return 'object'
  if (type === 'number' || type === 'integer') return 'number'
  if (type === 'string') return 'string'
  if (type === 'boolean') return 'boolean'

  if (
    '$ref' in definition ||
    'allOf' in definition ||
    'anyOf' in definition ||
    'oneOf' in definition
  ) {
    return 'schema'
  }

  return 'unknown'
}

async function fetchKeywordMap(draftUri: string): Promise<KeywordMap> {
  const metaSchema = await got(draftUri, { responseType: 'json' }).json<{
    properties?: Record<string, unknown>
  }>()

  const map: KeywordMap = new Map()

  for (const [key, definition] of Object.entries(metaSchema.properties ?? {})) {
    map.set(key, classifyShape(definition))
  }

  return map
}

export async function getKeywordMap(draftUri: string): Promise<KeywordMap> {
  const cached = _cache.get(draftUri)
  if (cached !== undefined) return cached

  const map = await fetchKeywordMap(draftUri)
  _cache.set(draftUri, map)
  return map
}

/** Expose for test pre-loading — avoids network calls in unit tests. */
export function seedKeywordMap(draftUri: string, map: KeywordMap): void {
  _cache.set(draftUri, map)
}
