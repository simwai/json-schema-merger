import { isPlainObject } from './guards.js'
import type { JsonObject, JsonValue, Schema } from './types.js'

export function resolveLocalRefs(schema: Schema): Schema {
  const defs = isPlainObject(schema['$defs']) ? (schema['$defs'] as JsonObject) : {}
  return resolveNode(schema, defs) as Schema
}

function resolveRef(ref: string, defs: JsonObject): JsonValue {
  if (!ref.startsWith('#/$defs/')) {
    throw new Error(
      `Cannot inline non-local $ref "${ref}". Only "#/$defs/<name>" pointers are supported.`
    )
  }
  const name = ref.slice('#/$defs/'.length)
  const resolved = defs[name]
  if (resolved === undefined) {
    throw new Error(`Cannot resolve $ref "${ref}": "${name}" is not defined in $defs.`)
  }
  return resolveNode(resolved, defs)
}

function resolveObject(node: JsonObject, defs: JsonObject): JsonObject {
  const result: JsonObject = {}
  for (const [key, value] of Object.entries(node)) {
    result[key] = resolveNode(value, defs)
  }
  return result
}

function resolveNode(node: JsonValue, defs: JsonObject): JsonValue {
  if (Array.isArray(node)) return node.map((item) => resolveNode(item, defs))
  if (!isPlainObject(node)) return node

  const ref = node['$ref']
  if (typeof ref === 'string') return resolveRef(ref, defs)

  return resolveObject(node, defs)
}
