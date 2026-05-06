# json-schema-merger

POC: Draft 2020-12 local JSON Schema merger.

## What it does

Merges two or more JSON Schema objects (Draft 2020-12, local, in-memory) using a set of keyword-family rules:

| Keyword family | Examples | Strategy |
|---|---|---|
| Array-union | `type`, `required`, `enum`, `examples` | Union + dedupe |
| Object-map | `properties`, `patternProperties`, `$defs` | Recurse per child key |
| Lower bound | `minimum`, `minLength`, `minItems`, `minProperties`, `minContains` | Keep stricter (larger) |
| Upper bound | `maximum`, `maxLength`, `maxItems`, `maxProperties`, `maxContains` | Keep stricter (smaller) |
| Annotation scalar | `title`, `description`, `default` | Last-writer-wins |
| Everything else | `additionalProperties`, `prefixItems`, `items`, ... | Last-writer-wins |

## What it does NOT do

These keywords throw `UnsupportedKeywordError` immediately:

- `$ref`, `$dynamicRef`, `$dynamicAnchor` — require reference resolution
- `unevaluatedProperties`, `unevaluatedItems` — require evaluation-state tracking
- `if`, `then`, `else`, `not` — require semantic/conditional evaluation
- `$anchor` — requires scope-aware reference resolution

Only `https://json-schema.org/draft/2020-12/schema` is supported. Both schemas must declare the same `$schema`. External documents, remote refs, and cross-resource `$id` scopes are out of scope for this POC.

## Install

```bash
pnpm install
```

## Usage

```ts
import { merge } from './src/index.js'

const result = merge(
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['id'],
    minProperties: 1,
    properties: { id: { type: 'string' } },
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: ['object', 'null'],
    required: ['name'],
    minProperties: 2,
    properties: { name: { type: 'string' } },
  }
)

console.log(JSON.stringify(result, null, 2))
// type: ['object', 'null'] (deduped union)
// required: ['id', 'name'] (deduped union)
// minProperties: 2 (stricter lower bound)
// properties: { id: ..., name: ... } (recursively merged)
```

## Test

```bash
pnpm test
```

## Roadmap

- [ ] `$ref` local resolution (same-document `#/$defs/...`)
- [ ] `if`/`then`/`else` policy (wrap in `allOf` instead of merging)
- [ ] `unevaluatedProperties` tracking
- [ ] Multi-draft support (Draft 7, Draft 2019-09)
