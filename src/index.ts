import { liftIfThenElse } from './if-then-else.js'
import { resolveLocalRefs } from './local-ref.js'
import { getKeywordMap } from './meta-schema.js'
import { mergeSchemas } from './merger.js'
import { runPreflight } from './preflight.js'
import type { Schema } from './types.js'
import { SUPPORTED_DRAFT } from './types.js'

export { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
export { seedKeywordMap } from './meta-schema.js'
export type { JsonObject, JsonPrimitive, JsonValue, Schema } from './types.js'
export { SUPPORTED_DRAFT }

function extractDraftUri(schema: Schema): string {
  return typeof schema['$schema'] === 'string' ? schema['$schema'] : SUPPORTED_DRAFT
}

function applyPreMergePasses(schema: Schema): Schema {
  return liftIfThenElse(resolveLocalRefs(schema))
}

export async function merge(...rawSchemas: [Schema, Schema, ...Schema[]]): Promise<Schema> {
  const keywordMap = await getKeywordMap(extractDraftUri(rawSchemas[0]))
  const schemas = rawSchemas.map(applyPreMergePasses)

  return schemas.slice(1).reduce<Schema>(
    (accumulated, next) => {
      runPreflight(accumulated, next)
      return mergeSchemas(accumulated, next, keywordMap)
    },
    schemas[0]
  )
}
