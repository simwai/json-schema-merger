# json-schema-merger

[![semantic-release](https://img.shields.io/badge/semantic--release-conventional-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)

Draft **2020-12**, **2019-09** and **Draft 7** JSON Schema merger with **runtime meta-schema keyword discovery**.
Fully tested, zero behaviour-changing workarounds.

## Supported drafts

| Draft | `$schema` URI |
|---|---|
| **2020-12** | `https://json-schema.org/draft/2020-12/schema` |
| **2019-09** | `https://json-schema.org/draft/2019-09/schema` |
| **Draft 7** | `https://json-schema.org/draft-07/schema` |
| **Draft 7 (alt)** | `http://json-schema.org/draft-07/schema#` |

All schemas in a single `merge()` call must share the same draft URI. Mixing drafts throws `DraftMismatchError`.

## How it works

Every `merge()` call runs three sequential phases:

```
raw schemas
    │
    ▼  1. Pre-merge passes (per schema)
    │     a. resolveLocalRefs   — inline #/$defs/... (2020-12 / 2019-09)
    │                              or #/definitions/... (Draft 7) $ref pointers
    │     b. liftIfThenElse     — rewrite if/then/else → allOf entries
    │
    ▼  2. Preflight (per adjacent pair)
    │     • $schema draft must match and be in SUPPORTED_DRAFTS
    │     • unsupported keywords are draft-aware (see table below)
    │
    ▼  3. Merge (left-fold over all schemas)
         getStrategy(key, keywordMap)
              │
              ├── override map hit  → pinned strategy (see table below)
              ├── shape = 'array'   → append-array  (union + dedupe)
              ├── shape = 'object'  → merge-object  (recurse per child key)
              └── shape = 'unknown' → overwrite     (last-writer-wins)
```

## Keyword strategy table

| Group | Keywords | Strategy |
|---|---|---|
| **Type / composition arrays** | `type` `allOf` `anyOf` `oneOf` `prefixItems` `enum` `examples` `required` `items` | `append-array` — deduped union |
| **Object maps** | `properties` `$defs` `definitions` `patternProperties` `dependentRequired` | `merge-object` — recurse per child key |
| **Lower bounds** | `minimum` `exclusiveMinimum` `minLength` `minItems` `minProperties` `minContains` | `max-number` — keep stricter (larger) |
| **Upper bounds** | `maximum` `exclusiveMaximum` `maxLength` `maxItems` `maxProperties` `maxContains` | `min-number` — keep stricter (smaller) |
| **Annotations** | `title` `description` `default` `format` `pattern` … | `overwrite` — last-writer-wins |
| **Unsupported (all drafts)** | `$dynamicRef` `$dynamicAnchor` `$anchor` `not` | `fail-fast` — throws immediately |
| **Unsupported (2020-12 / 2019-09)** | `unevaluatedProperties` `unevaluatedItems` | `fail-fast` — throws immediately |
| **Unsupported (2019-09 only)** | `$recursiveRef` `$recursiveAnchor` | `fail-fast` — throws immediately |

## Pre-merge passes

### Local `$ref` resolution

Pointers are resolved based on the active draft before merging:

**2020-12 / 2019-09** — resolves `#/$defs/<name>`:

```ts
const result = await merge(
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $defs: { UserId: { type: 'string', minLength: 1 } },
    properties: { id: { $ref: '#/$defs/UserId' } },
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    properties: { id: { type: 'string', minLength: 5 } },
  }
)
// properties.id.minLength → 5  (stricter lower bound wins)
```

**Draft 7** — resolves `#/definitions/<name>`:

```ts
const result = await merge(
  {
    $schema: 'https://json-schema.org/draft-07/schema',
    definitions: { Token: { type: 'string', minLength: 8 } },
    properties: { token: { $ref: '#/definitions/Token' } },
  },
  {
    $schema: 'https://json-schema.org/draft-07/schema',
    properties: { token: { maxLength: 64 } },
  }
)
// properties.token.minLength → 8
// properties.token.maxLength → 64
```

Non-local `$ref` values (external URIs) throw immediately with a clear message.

### `if`/`then`/`else` → `allOf` lift

Conditional keywords are rewritten into semantically equivalent `allOf` entries:

```
{ if: C, then: T, else: E }
  → allOf: [
      { if: C,         then: T },
      { if: { not: C }, then: E },
    ]
```

This lets the merger treat them as ordinary composition arrays.

## Architecture

```
src/
├── index.ts          — public API: merge(), re-exports
├── types.ts          — JsonValue, Schema, KeywordShape, MergeStrategy,
│                        SUPPORTED_DRAFT, SUPPORTED_DRAFTS
├── errors.ts         — DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError
├── guards.ts         — isPlainObject(), toArray()
├── dedupe.ts         — dedupeJsonArray()
├── local-ref.ts      — resolveLocalRefs(schema, draftUri) pre-merge pass
├── if-then-else.ts   — liftIfThenElse() pre-merge pass
├── preflight.ts      — runPreflight() — draft + unsupported keyword checks
├── merger.ts         — mergeSchemas(), mergeByStrategy(), mergeChildSchemas()
├── strategy.ts       — getStrategy(), _strategyOverrides map
├── meta-schema.ts    — getKeywordMap(), seedKeywordMap(), shape classifiers
└── __fixtures__/
    └── draft-2020-12-keywords.json  — generated from live meta-schema
```

## Keyword classification

The fixture `src/__fixtures__/draft-2020-12-keywords.json` is generated by
`scripts/generate-fixtures.ts` from the real meta-schema. Tests load this same
file via `seedKeywordMap` — production and test classification are always in sync.

For Draft 7 and 2019-09 the same fixture is used as a seed (shape-based
fallback). All draft-specific keywords are covered by explicit overrides in
`strategy.ts`, so no additional fixture files are needed.

To regenerate after a draft update:

```bash
npx tsx scripts/generate-fixtures.ts
```

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
    properties: {
      id: { type: 'string', minLength: 1 },
    },
  },
  {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: ['object', 'null'],
    required: ['name'],
    minProperties: 2,
    properties: {
      id:   { type: 'string', minLength: 5 },
      name: { type: 'string' },
    },
  }
)

// type:          ['object', 'null']   deduped union
// required:      ['id', 'name']       deduped union
// minProperties: 2                    stricter lower bound
// properties.id.minLength: 5          stricter lower bound
// properties.name: { type: 'string' }
```

Draft 7 works identically — swap the `$schema` URI and use `definitions` instead of `$defs`:

```ts
const result = await merge(
  {
    $schema: 'https://json-schema.org/draft-07/schema',
    required: ['id'],
    definitions: { Id: { type: 'string', minLength: 1 } },
    properties: { id: { $ref: '#/definitions/Id' } },
  },
  {
    $schema: 'https://json-schema.org/draft-07/schema',
    required: ['name'],
    properties: { name: { type: 'string' } },
  }
)
```

## API

```ts
merge(...schemas: [Schema, Schema, ...Schema[]]): Promise<Schema>
```

Accepts two or more schemas. Folds left-to-right. All schemas must share the same `$schema` draft URI.

```ts
seedKeywordMap(draftUri: string, map: Map<string, KeywordShape>): void
```

Pre-loads the keyword map cache — use in tests to avoid network calls.

```ts
import { SUPPORTED_DRAFTS } from 'json-schema-merger'
// ReadonlySet<string> of all accepted $schema URIs
```

### Errors

| Class | Thrown when |
|---|---|
| `DraftMismatchError` | Two schemas in the same call declare different `$schema` values |
| `UnsupportedDraftError` | `$schema` is not in `SUPPORTED_DRAFTS` |
| `UnsupportedKeywordError` | A schema contains a fail-fast keyword (`not`, `unevaluatedProperties`, …) |

## Releasing

Releases are driven by [semantic-release](https://github.com/semantic-release/semantic-release) on every push to `master`.
Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

| Commit prefix | Version bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` | major |

```bash
pnpm run release   # dry-run locally (needs GITHUB_TOKEN + NPM_TOKEN env vars)
```

[commitlint](https://commitlint.js.org/) + [husky](https://typicode.github.io/husky/) enforce commit format and run `build` + `test` before every commit.

## Test

```bash
pnpm test
```

55 tests, all green. Run time < 500 ms (fixture-seeded, no network).

## Roadmap

- [x] Local `$ref` resolution (`#/$defs/...` within the same document)
- [x] `if`/`then`/`else` — wrap both sides in `allOf` instead of merging
- [x] Multi-draft support — Draft 7, Draft 2019-09, Draft 2020-12
- [x] Automated releases via semantic-release + commitlint
- [ ] `unevaluatedProperties` tracking
