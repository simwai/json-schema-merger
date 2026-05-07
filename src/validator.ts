import { Type, type Static, type TObject, type TSchema } from '@sinclair/typebox'
import { TypeCompiler, type TypeCheck } from '@sinclair/typebox/compiler'
import type { Schema } from './types.js'

// ── Reusable leaf types ───────────────────────────────────────────────────────

const JsonPrimitive = Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()])

// JsonValue is self-referential — TypeBox handles this via Type.Recursive
const JsonValue = Type.Recursive((Self) =>
  Type.Union([JsonPrimitive, Type.Array(Self), Type.Record(Type.String(), Self)])
)

// ── Core JSON Schema keyword shapes ──────────────────────────────────────────

const SchemaType = Type.Union([
  Type.String(),
  Type.Array(Type.String()),
])

const SchemaProperties = Type.Record(
  Type.String(),
  Type.Record(Type.String(), JsonValue)
)

const SchemaDefs = Type.Record(
  Type.String(),
  Type.Record(Type.String(), JsonValue)
)

// ── The merged schema shape ───────────────────────────────────────────────────
// Covers the keywords your merger actually touches (merger.ts / strategy.ts).
// All fields are optional because not every merge result will contain all of them.

export const MergedSchemaShape = Type.Object({
  $schema:      Type.Optional(Type.String()),
  type:         Type.Optional(SchemaType),
  title:        Type.Optional(Type.String()),
  description:  Type.Optional(Type.String()),

  // Validation — numeric bounds
  minimum:      Type.Optional(Type.Number()),
  maximum:      Type.Optional(Type.Number()),
  minLength:    Type.Optional(Type.Number()),
  maxLength:    Type.Optional(Type.Number()),
  minItems:     Type.Optional(Type.Number()),
  maxItems:     Type.Optional(Type.Number()),
  minProperties: Type.Optional(Type.Number()),
  maxProperties: Type.Optional(Type.Number()),

  // Structural
  required:    Type.Optional(Type.Array(Type.String())),
  properties:  Type.Optional(SchemaProperties),
  enum:        Type.Optional(Type.Array(JsonValue)),

  // Composition
  allOf: Type.Optional(Type.Array(Type.Record(Type.String(), JsonValue))),
  anyOf: Type.Optional(Type.Array(Type.Record(Type.String(), JsonValue))),
  oneOf: Type.Optional(Type.Array(Type.Record(Type.String(), JsonValue))),

  // Definitions (both draft styles)
  $defs:       Type.Optional(SchemaDefs),
  definitions: Type.Optional(SchemaDefs),
}, { additionalProperties: true })

export type MergedSchema = Static<typeof MergedSchemaShape>

// ── Pre-compiled validator (fast path) ───────────────────────────────────────

const _check: TypeCheck<typeof MergedSchemaShape> = TypeCompiler.Compile(MergedSchemaShape)

/**
 * Validates that a raw `Schema` (the output of `merge()`) matches the expected
 * merged-schema shape. Narrows the return type to `MergedSchema` on success.
 *
 * @example
 * const result = await merge(a, b)
 * if (validateMerged(result)) {
 *   result.required // string[] | undefined  ✅
 * }
 */
export function validateMerged(schema: Schema): schema is MergedSchema {
  return _check.Check(schema)
}

/**
 * Same as `validateMerged` but throws a descriptive `TypeError` on failure
 * instead of returning `false`. Use when you want to assert correctness and
 * surface problems early.
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
 * Compiles a custom TypeBox schema against the result of `merge()`.
 * Use this when you want to validate a more specific shape than `MergedSchema`.
 *
 * @example
 * const check = compileMergedValidator(Type.Object({ required: Type.Array(Type.String()) }))
 * if (check(result)) { result.required }
 */
export function compileMergedValidator<T extends TObject>(
  shape: T
): (schema: Schema) => schema is Static<T> {
  const compiled = TypeCompiler.Compile(shape)
  return (schema: Schema): schema is Static<T> => compiled.Check(schema)
}
