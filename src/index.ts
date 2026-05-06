import { mergeSchemas } from './merger.js'
import { runPreflight } from './preflight.js'
import type { Schema } from './types.js'

export { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError } from './errors.js'
export type { JsonObject, JsonPrimitive, JsonValue, Schema } from './types.js'

export function merge(...schemas: [Schema, Schema, ...Schema[]]): Schema {
  return schemas.reduce<Schema>((accumulated, next) => {
    runPreflight(accumulated, next)
    return mergeSchemas(accumulated, next)
  })
}
