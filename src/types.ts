export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonObject
  | JsonValue[]

export type JsonObject = Record<string, JsonValue>

export type Schema = JsonObject

export const SUPPORTED_DRAFT = 'https://json-schema.org/draft/2020-12/schema' as const

/**
 * Keywords that cannot be safely merged by this POC.
 * Merging them would silently produce semantically wrong output.
 */
export const UNSUPPORTED_KEYWORDS = new Set([
  '$ref',
  '$dynamicRef',
  '$dynamicAnchor',
  'unevaluatedProperties',
  'unevaluatedItems',
  'if',
  'then',
  'else',
  'not',
  '$anchor',
]) as ReadonlySet<string>

/**
 * Keywords whose values are arrays (or normalised to arrays).
 * Merge strategy: union + dedupe.
 */
export const ARRAY_UNION_KEYWORDS = new Set([
  'type',
  'required',
  'enum',
  'examples',
]) as ReadonlySet<string>

/**
 * Keywords whose value is an object map of child schemas.
 * Merge strategy: recurse per child key.
 */
export const OBJECT_MAP_KEYWORDS = new Set([
  'properties',
  'patternProperties',
  '$defs',
]) as ReadonlySet<string>

/**
 * Numeric lower bounds — merge strategy: keep stricter (larger) value.
 */
export const LOWER_BOUND_KEYWORDS = new Set([
  'minimum',
  'exclusiveMinimum',
  'minLength',
  'minItems',
  'minProperties',
  'minContains',
]) as ReadonlySet<string>

/**
 * Numeric upper bounds — merge strategy: keep stricter (smaller) value.
 */
export const UPPER_BOUND_KEYWORDS = new Set([
  'maximum',
  'exclusiveMaximum',
  'maxLength',
  'maxItems',
  'maxProperties',
  'maxContains',
]) as ReadonlySet<string>
