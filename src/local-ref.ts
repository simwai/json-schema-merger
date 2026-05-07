import { isPlainObject } from './guards.js'
import type { JsonObject, JsonValue, Schema } from './types.js'

/**
 * Resolves all `$ref` values of the form `#/$defs/<name>` by inlining
 * the referenced definition from `$defs` in the same document.
 * Throws if a `$ref` cannot be resolved locally.
 */
export function resolveLocalRefs(schema: Schema): Schema {
  const defs = schema['$defs']
  if (!isPlainObject(defs)) return schema
  return resolveNode(schema, defs as JsonObject) as Schema
}

function resolveNode(node: JsonValue, defs: JsonObject): JsonValue {
  if (Array.isArray(node)) return node.map((item) => resolveNode(item, defs))
  if (!isPlainObject(node)) return node

  const ref = node['$ref']
  if (typeof ref === 'string') {
    if (!ref.startsWith('#/$defs/')) {
      throw new Error(
        `Cannot inline non-local $ref "${ref}". Only "#/$defs/<name>" pointers are supported.`
      )
    }
    const name = ref.slice('#/$defs/'.length)
    const resolved = defs[name]
    if (resolved === undefined) {
      throw new Error(
        `Cannot resolve $ref "${ref}": "${name}" is not defined in $defs.`
      )
    }
    // Inline the definition (omit the $ref key itself).
    return resolveNode(resolved, defs)
  }

  const result: JsonObject = {}
  for (const [key, value] of Object.entries(node)) {
    result[key] = resolveNode(value, defs)
  }
  return result
}
