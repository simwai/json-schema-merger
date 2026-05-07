import { isPlainObject } from './guards.js'
import type { JsonObject, Schema } from './types.js'

/**
 * Lifts `if`/`then`/`else` out of a schema before merging by wrapping them
 * in `allOf` entries instead of letting them pass through as-is.
 *
 * Draft 2020-12 semantics:
 *   { if: C, then: T, else: E } ≡ allOf: [{ if: C, then: T }, { if: { not: C }, then: E }]
 *
 * The resulting schema has no `if`/`then`/`else` keys — it is safe for the
 * standard merger to process.
 */
export function liftIfThenElse(schema: Schema): Schema {
  const ifClause = schema['if']
  const thenClause = schema['then']
  const elseClause = schema['else']

  if (!isPlainObject(ifClause)) return schema

  const lifted: JsonObject[] = []

  if (isPlainObject(thenClause)) {
    lifted.push({ if: ifClause as JsonObject, then: thenClause as JsonObject })
  }

  if (isPlainObject(elseClause)) {
    lifted.push({
      if: { not: ifClause as JsonObject },
      then: elseClause as JsonObject,
    })
  }

  if (lifted.length === 0) return schema

  const { if: _if, then: _then, else: _else, ...rest } = schema as Record<string, unknown>
  void _if; void _then; void _else

  const existing = Array.isArray(rest['allOf']) ? (rest['allOf'] as JsonObject[]) : []
  return { ...rest, allOf: [...existing, ...lifted] } as Schema
}
