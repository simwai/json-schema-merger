import { isPlainObject } from './guards.js'
import type { JsonObject, JsonValue, Schema } from './types.js'
import { DRAFT_7 } from './types.js'

function defsKey(draftUri: string): string {
  return draftUri === DRAFT_7 ? 'definitions' : '$defs'
}

export function resolveLocalRefs(schema: Schema, draftUri: string): Schema {
  const key = defsKey(draftUri)
  const defs = isPlainObject(schema[key]) ? (schema[key] as JsonObject) : {}
  return resolveNode(schema, defs) as Schema
}

function resolveRef(ref: string, defs: JsonObject): JsonValue {
  const localPrefix = '#/$defs/'
  const legacyPrefix = '#/definitions/'

  let name: string | undefined
  if (ref.startsWith(localPrefix)) name = ref.slice(localPrefix.length)
  else if (ref.startsWith(legacyPrefix)) name = ref.slice(legacyPrefix.length)

  if (name === undefined) {
    throw new Error(
      `Cannot inline non-local $ref "${ref}". ` +
      `Only "#/$defs/<name>" and "#/definitions/<name>" pointers are supported.`
    )
  }

  const resolved = defs[name]
  if (resolved === undefined) {
    throw new Error(`Cannot resolve $ref "${ref}": "${name}" is not defined.`)
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
