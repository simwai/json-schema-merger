import { isPlainObject } from './guards.js'
import type { JsonObject, Schema } from './types.js'

export function liftIfThenElse(schema: Schema): Schema {
  const ifClause = schema['if']
  if (!isPlainObject(ifClause)) return schema

  const lifted = [
    buildThenEntry(ifClause as JsonObject, schema['then']),
    buildElseEntry(ifClause as JsonObject, schema['else']),
  ].filter((entry): entry is JsonObject => entry !== undefined)

  if (lifted.length === 0) return schema

  const existing = Array.isArray(schema['allOf']) ? (schema['allOf'] as JsonObject[]) : []
  return {
    ...omitKeys(schema, ['if', 'then', 'else']),
    allOf: [...existing, ...lifted],
  } as Schema
}

function buildThenEntry(
  ifClause: JsonObject,
  thenClause: unknown
): JsonObject | undefined {
  if (!isPlainObject(thenClause)) return undefined
  return { if: ifClause, then: thenClause as JsonObject }
}

function buildElseEntry(
  ifClause: JsonObject,
  elseClause: unknown
): JsonObject | undefined {
  if (!isPlainObject(elseClause)) return undefined
  return { if: { not: ifClause }, then: elseClause as JsonObject }
}

function omitKeys(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const keySet = new Set(keys)
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keySet.has(k)))
}
