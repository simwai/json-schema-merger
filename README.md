# json-schema-merger

POC: Draft 2020-12 local JSON Schema merger with **runtime meta-schema keyword discovery**.

## How it works

On the first `merge()` call the library fetches the declared `$schema` URI via `got`, reads its `properties` block, and classifies each keyword into a shape. That shape drives the default merge strategy. The result is cached for the lifetime of the process.

A small override map handles the keywords where shape alone is not enough (numeric bounds, fail-fast advanced keywords).

```
$schema URI
    │
    ▼
 got(uri) → metaSchema.properties
    │
    ▼
 classifyShape(definition) → KeywordShape
    │  signals checked in order:
    │  1. direct "type" field
    │  2. "default" value shape
    │  3. structural hints (items / prefixItems / uniqueItems)
    │  4. anyOf/oneOf branch consensus
    │  5. $ref present → 'schema'
    │  6. fallback → 'unknown'
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

## Keyword classification (Draft 2020-12)

The fixture file `src/__fixtures__/draft-2020-12-keywords.json` is **generated** by
`scripts/generate-fixtures.ts` from the real meta-schema. Tests load this same file,
so production and test classification are always in sync.

To regenerate after a draft update:

```bash
npx tsx scripts/generate-fixtures.ts
```

## Unsupported keywords (fail-fast)

These throw `UnsupportedKeywordError` immediately:

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
// type: ['object', 'null']   — deduped union
// required: ['id', 'name']   — deduped union
// minProperties: 2           — stricter lower bound
// properties: { id, name }   — recursively merged
```

## Test

```bash
pnpm test
```

## Roadmap

- [ ] Local `$ref` resolution (`#/$defs/...` within the same document)
- [ ] `if`/`then`/`else` — wrap both sides in `allOf` instead of merging
- [ ] `unevaluatedProperties` tracking
- [ ] Multi-draft support (Draft 7, Draft 2019-09)
