import got from 'got'
import { isPlainObject } from './guards.js'
import type { KeywordShape } from './types.js'

export type KeywordMap = Map<string, KeywordShape>

const keywordMapCache = new Map<string, KeywordMap>()

function classifyByDirectType(definition: Record<string, unknown>): KeywordShape | undefined {
  const type = definition['type']
  if (type === 'array') return 'array'
  if (type === 'object') return 'object'
  if (type === 'number' || type === 'integer') return 'number'
  if (type === 'string') return 'string'
  if (type === 'boolean') return 'boolean'
  return undefined
}

function classifyByDefault(definition: Record<string, unknown>): KeywordShape | undefined {
  const defaultVal = definition['default']
  if (Array.isArray(defaultVal)) return 'array'
  if (isPlainObject(defaultVal)) return 'object'
  return undefined
}

function classifyByStructuralHints(definition: Record<string, unknown>): KeywordShape | undefined {
  if ('items' in definition || 'prefixItems' in definition || 'uniqueItems' in definition) {
    return 'array'
  }
  return undefined
}

function classifyByBranches(definition: Record<string, unknown>): KeywordShape | undefined {
  const branches = definition['anyOf'] ?? definition['oneOf']
  if (!Array.isArray(branches)) return undefined

  const branchTypes = new Set(
    branches
      .filter(isPlainObject)
      .map((b) => b['type'])
      .filter((t): t is string => typeof t === 'string')
  )

  if (branchTypes.size !== 1) return undefined

  const [inferredType] = [...branchTypes] as [string]
  return classifyByDirectType({ type: inferredType })
}

function classifyShape(definition: unknown): KeywordShape {
  if (!isPlainObject(definition)) return 'unknown'
  if ('$ref' in definition) return 'schema'

  return (
    classifyByDirectType(definition) ??
    classifyByDefault(definition) ??
    classifyByStructuralHints(definition) ??
    classifyByBranches(definition) ??
    'unknown'
  )
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
  const cached = keywordMapCache.get(draftUri)
  if (cached !== undefined) return cached

  const map = await fetchKeywordMap(draftUri)
  keywordMapCache.set(draftUri, map)
  return map
}

export function seedKeywordMap(draftUri: string, map: KeywordMap): void {
  keywordMapCache.set(draftUri, map)
}
