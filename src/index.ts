import { getKeywordMap } from './meta-schema.js'
import { mergeSchemas } from './merger.js'
import { runPreflight } from './preflight.js'
import type { Schema } from './types.js'
import { SUPPORTED_DRAFT } from './types.js'

export { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
export { seedKeywordMap } from './meta-schema.js'
export type { JsonObject, JsonPrimitive, JsonValue, Schema } from './types.js'
export { SUPPORTED_DRAFT }

export async function merge(...schemas: [Schema, Schema, ...Schema[]]): Promise<Schema> {
  // All schemas must share the same draft — validated in preflight.
  // Safe to read $schema from the first schema after that check.
  const draftUri = typeof schemas[0]?.['$schema'] === 'string'
    ? schemas[0]['$schema']
    : SUPPORTED_DRAFT

  const keywordMap = await getKeywordMap(draftUri)

  return schemas.reduce<Schema>((accumulated, next) => {
    runPreflight(accumulated, next)
    return mergeSchemas(accumulated, next, keywordMap)
  })
}
