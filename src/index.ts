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
export { SUPPORTED_DRAFT, SUPPORTED_DRAFTS }
export {
  MergedSchemaShape,
  assertMerged,
  compileMergedValidator,
  validateMerged,
} from './validator.js'
export type { MergedSchema } from './validator.js'

function extractDraftUri(schema: Schema): string {
  if (typeof schema['$schema'] !== 'string') return SUPPORTED_DRAFT
  const uri = schema['$schema']
  return SUPPORTED_DRAFTS.has(uri) ? uri : uri
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
