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

export const DRAFT_7       = 'http://json-schema.org/draft-07/schema#' as const
export const DRAFT_2019_09 = 'https://json-schema.org/draft/2019-09/schema' as const
export const DRAFT_2020_12 = 'https://json-schema.org/draft/2020-12/schema' as const

export const SUPPORTED_DRAFT  = DRAFT_2020_12
export const SUPPORTED_DRAFTS = new Set([DRAFT_7, DRAFT_2019_09, DRAFT_2020_12] as const)
