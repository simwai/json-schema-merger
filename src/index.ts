import { UnsupportedDraftError } from './errors.js'
import { liftIfThenElse } from './if-then-else.js'
import { resolveLocalRefs } from './local-ref.js'
import { getKeywordMap } from './meta-schema.js'
import { mergeSchemas } from './merger.js'
import { runPreflight } from './preflight.js'
import type { Schema } from './types.js'
import { SUPPORTED_DRAFT, SUPPORTED_DRAFTS } from './types.js'

export { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
export { seedKeywordMap } from './meta-schema.js'
export type { JsonObject, JsonPrimitive, JsonValue, Schema } from './types.js'
export { DRAFT_7, DRAFT_2019_09, DRAFT_2020_12, SUPPORTED_DRAFT, SUPPORTED_DRAFTS }

function extractDraftUri(schema: Schema): string {
  const uri = typeof schema['$schema'] === 'string' ? schema['$schema'] : undefined
  if (uri === undefined || !SUPPORTED_DRAFTS.has(uri)) throw new UnsupportedDraftError(uri)
  return uri
}

function applyPreMergePasses(schema: Schema, draftUri: string): Schema {
  return liftIfThenElse(resolveLocalRefs(schema, draftUri))
}

export async function merge(...rawSchemas: [Schema, Schema, ...Schema[]]): Promise<Schema> {
  const draftUri = extractDraftUri(rawSchemas[0])
  const keywordMap = await getKeywordMap(draftUri)
  const schemas = rawSchemas.map((s) => applyPreMergePasses(s, draftUri))

  return schemas.slice(1).reduce<Schema>(
    (accumulated, next) => {
      runPreflight(accumulated, next)
      return mergeSchemas(accumulated, next, keywordMap)
    },
    schemas[0]
  )
}
