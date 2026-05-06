# json-schema-merger

POC: Draft 2020-12 local JSON Schema merger with **runtime meta-schema keyword discovery**.

## How it works

On the first `merge()` call, the library fetches the declared `$schema` URI (e.g. the Draft 2020-12 meta-schema) via `got` and reads its `properties` to classify each keyword's shape. That shape drives the default merge strategy. The result is cached for the lifetime of the process — no repeated network calls.

A small override map handles the keywords where shape alone is not enough (numeric bounds, fail-fast advanced keywords).

```
$schema URI
    │
    ▼
 got(uri) → metaSchema.properties
    │
    ▼
 classifyShape(definition) → KeywordShape
    │
    ▼
 getStrategy(key, keywordMap)
    │
    ├── shape = 'array'   → append-array  (union + dedupe)
    ├── shape = 'object'  → merge-object  (recurse per child key)
    ├── override min*     → max-number    (stricter lower bound)
    ├── override max*     → min-number    (stricter upper bound)
    ├── override $ref etc → fail-fast     (throws immediately)
    └── everything else   → overwrite     (last-writer-wins)
```

## Unsupported keywords (fail-fast)

These throw `UnsupportedKeywordError` immediately because they require evaluation-state tracking or reference resolution:

`$ref` · `$dynamicRef` · `$dynamicAnchor` · `$anchor` · `unevaluatedProperties` · `unevaluatedItems` · `if` · `then` · `else` · `not`

## Install

```bash
pnpm install
```

## Usage

```ts
import { merge } from './src/index.js'

const result = await merge(
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
// type: ['object', 'null']   — deduped union (shape: array)
// required: ['id', 'name']   — deduped union (shape: array)
// minProperties: 2           — stricter lower bound (override)
// properties: { id, name }   — recursively merged (shape: object)
```

## Test

Tests pre-seed the keyword map via `seedKeywordMap()` so no network calls are needed:

```bash
pnpm test
```

## Roadmap

- [ ] Local `$ref` resolution (`#/$defs/...` within the same document)
- [ ] `if`/`then`/`else` — wrap both sides in `allOf` instead of merging
- [ ] `unevaluatedProperties` tracking
- [ ] Multi-draft support (Draft 7, Draft 2019-09)
