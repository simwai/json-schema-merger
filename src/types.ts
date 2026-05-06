export type JsonPrimitive = string | number | boolean | null
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[]
export type JsonObject = Record<string, JsonValue>
export type Schema = JsonObject

export type KeywordShape =
  | 'array'
  | 'object'
  | 'number'
  | 'string'
  | 'boolean'
  | 'schema'
  | 'unknown'

export type MergeStrategy =
  | 'append-array'
  | 'merge-object'
  | 'max-number'
  | 'min-number'
  | 'overwrite'
  | 'fail-fast'

export const SUPPORTED_DRAFT = 'https://json-schema.org/draft/2020-12/schema' as const
