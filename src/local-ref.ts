import { isPlainObject } from './guards.js'
import type { JsonObject, JsonValue, Schema } from './types.js'

const _draft7DefsKey = 'definitions'
const _modernDefsKey = '$defs'
const _draft7DefsPrefix = '#/definitions/'
const _modernDefsPrefix = '#/$defs/'

function defsKeyForDraft(draftUri: string): string {
  return draftUri === 'https://json-schema.org/draft-07/schema' ||
         draftUri === 'http://json-schema.org/draft-07/schema#'
    ? _draft7DefsKey
    : _modernDefsKey
}

export function resolveLocalRefs(schema: Schema, draftUri: string): Schema {
  const defsKey = defsKeyForDraft(draftUri)
  const prefix = defsKey === _draft7DefsKey ? _draft7DefsPrefix : _modernDefsPrefix
  const defs = isPlainObject(schema[defsKey]) ? (schema[defsKey] as JsonObject) : {}
  return resolveNode(schema, defs, prefix) as Schema
}

function resolveRef(ref: string, defs: JsonObject, prefix: string): JsonValue {
  if (!ref.startsWith(prefix)) {
    throw new Error(
      `Cannot inline non-local $ref "${ref}". Only "${prefix}<name>" pointers are supported.`
    )
  }
  const name = ref.slice(prefix.length)
  const resolved = defs[name]
  if (resolved === undefined) {
    throw new Error(`Cannot resolve $ref "${ref}": "${name}" is not defined in ${prefix.replace('#/', '').replace('/', '')}.`)
  }
  return resolveNode(resolved, defs, prefix)
}

function resolveObject(node: JsonObject, defs: JsonObject, prefix: string): JsonObject {
  const result: JsonObject = {}
  for (const [key, value] of Object.entries(node)) {
    result[key] = resolveNode(value, defs, prefix)
  }
  return result
}

function resolveNode(node: JsonValue, defs: JsonObject, prefix: string): JsonValue {
  if (Array.isArray(node)) return node.map((item) => resolveNode(item, defs, prefix))
  if (!isPlainObject(node)) return node

  const ref = node['$ref']
  if (typeof ref === 'string') return resolveRef(ref, defs, prefix)

  return resolveObject(node, defs, prefix)
}
