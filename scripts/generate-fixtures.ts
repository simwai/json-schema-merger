/**
 * Fetches the Draft 2020-12 meta-schema and writes the classified keyword map
 * to src/__fixtures__/draft-2020-12-keywords.json.
 *
 * Run once (or on draft updates):
 *   npx tsx scripts/generate-fixtures.ts
 *
 * The output is committed so tests and production share the exact same
 * classification — no fixture drift possible.
 */
import got from 'got'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isPlainObject } from '../src/guards.js'
import type { KeywordShape } from '../src/types.js'

const DRAFT_URI = 'https://json-schema.org/draft/2020-12/schema'
const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../src/__fixtures__/draft-2020-12-keywords.json')

function classifyShape(definition: unknown): KeywordShape {
  if (!isPlainObject(definition)) return 'unknown'

  const type = definition['type']
  if (type === 'array') return 'array'
  if (type === 'object') return 'object'
  if (type === 'number' || type === 'integer') return 'number'
  if (type === 'string') return 'string'
  if (type === 'boolean') return 'boolean'

  const defaultVal = definition['default']
  if (Array.isArray(defaultVal)) return 'array'
  if (isPlainObject(defaultVal)) return 'object'

  if (
    'items' in definition ||
    'prefixItems' in definition ||
    'uniqueItems' in definition
  ) return 'array'

  const branches = definition['anyOf'] ?? definition['oneOf']
  if (Array.isArray(branches)) {
    const types = new Set(
      branches
        .filter(isPlainObject)
        .map((b) => b['type'])
        .filter((t): t is string => typeof t === 'string')
    )
    if (types.size === 1) {
      const [inferredType] = [...types] as [string]
      if (inferredType === 'array') return 'array'
      if (inferredType === 'object') return 'object'
      if (inferredType === 'number' || inferredType === 'integer') return 'number'
      if (inferredType === 'string') return 'string'
      if (inferredType === 'boolean') return 'boolean'
    }
  }

  if ('$ref' in definition) return 'schema'
  return 'unknown'
}

const metaSchema = await got(DRAFT_URI, { responseType: 'json' }).json<{
  properties?: Record<string, unknown>
}>()

const result: Record<string, KeywordShape> = {}

for (const [key, definition] of Object.entries(metaSchema.properties ?? {})) {
  result[key] = classifyShape(definition)
}

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8')

console.log(`Written ${Object.keys(result).length} keywords to ${OUT_PATH}`)
console.log(JSON.stringify(result, null, 2))
