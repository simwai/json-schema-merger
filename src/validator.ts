import { Type, type Static, type TObject } from '@sinclair/typebox'
import { TypeCompiler, type TypeCheck } from '@sinclair/typebox/compiler'
import {
  arrayUnionKeywords,
  failFastKeywords,
  lowerBoundKeywords,
  objectMapKeywords,
  upperBoundKeywords,
} from './strategy.js'
import type { Schema } from './types.js'

// ── Leaf types ────────────────────────────────────────────────────────────────

const JsonPrimitive = Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()])

const JsonValue = Type.Recursive((Self) =>
  Type.Union([JsonPrimitive, Type.Array(Self), Type.Record(Type.String(), Self)])
)

const AnyObject = Type.Record(Type.String(), JsonValue)

// ── Build shape from strategy keyword lists ───────────────────────────────────────
// Each keyword's TypeBox type is derived directly from its MergeStrategy so
// validator.ts never diverges from strategy.ts.

function optionalEntries<T extends TObject['properties'][string]>(
  keys: ReadonlyArray<string>,
  make: () => T
): Record<string, ReturnType<typeof Type.Optional<T>>> {
  return Object.fromEntries(keys.map((k) => [k, Type.Optional(make())]))
}

const lowerBoundProps  = optionalEntries(lowerBoundKeywords,  () => Type.Number())
const upperBoundProps  = optionalEntries(upperBoundKeywords,  () => Type.Number())
const objectMapProps   = optionalEntries(objectMapKeywords,   () => Type.Record(Type.String(), AnyObject))
const arrayUnionProps  = optionalEntries(arrayUnionKeywords,  () => Type.Array(JsonValue))
// fail-fast keywords are rejected at runtime by preflight — omit from the
// validator shape so they can never appear in a valid merged result.
void failFastKeywords

// ── Annotations & core (not in strategy lists, always overwrite) ──────────────

const coreProps = {
  $schema:     Type.Optional(Type.String()),
  title:       Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  $id:         Type.Optional(Type.String()),
  $comment:    Type.Optional(Type.String()),
  $ref:        Type.Optional(Type.String()),
  const:       Type.Optional(JsonValue),
  default:     Type.Optional(JsonValue),
  deprecated:  Type.Optional(Type.Boolean()),
  readOnly:    Type.Optional(Type.Boolean()),
  writeOnly:   Type.Optional(Type.Boolean()),
}

// ── Final merged schema shape ───────────────────────────────────────────────

export const MergedSchemaShape = Type.Object(
  {
    ...coreProps,
    ...lowerBoundProps,
    ...upperBoundProps,
    ...objectMapProps,
    ...arrayUnionProps,
  },
  { additionalProperties: true }
)

export type MergedSchema = Static<typeof MergedSchemaShape>

// ── Pre-compiled validator ───────────────────────────────────────────────────

const _check: TypeCheck<typeof MergedSchemaShape> = TypeCompiler.Compile(MergedSchemaShape)

/**
 * Type guard. Narrows `Schema` → `MergedSchema` on success.
 *
 * @example
 * const result = await merge(a, b)
 * if (validateMerged(result)) {
 *   result.required // string[] | undefined ✅
 * }
 */
export function validateMerged(schema: Schema): schema is MergedSchema {
  return _check.Check(schema)
}

/**
 * Asserts variant. Throws a descriptive `TypeError` with full TypeBox error
 * paths if validation fails.
 *
 * @throws {TypeError}
 */
export function assertMerged(schema: Schema): asserts schema is MergedSchema {
  if (_check.Check(schema)) return
  const errors = [..._check.Errors(schema)]
    .map((e) => `  ${e.path}: ${e.message}`)
    .join('\n')
  throw new TypeError(`Merged schema validation failed:\n${errors}`)
}

/**
 * Compiles a custom TypeBox `TObject` into a reusable type guard.
 * Use when you need a stricter or more specific shape than `MergedSchema`.
 *
 * @example
 * const check = compileMergedValidator(
 *   Type.Object({ required: Type.Array(Type.String()) })
 * )
 * if (check(result)) { result.required }
 */
export function compileMergedValidator<T extends TObject>(
  shape: T
): (schema: Schema) => schema is Static<T> {
  const compiled = TypeCompiler.Compile(shape)
  return (schema: Schema): schema is Static<T> => compiled.Check(schema)
}
