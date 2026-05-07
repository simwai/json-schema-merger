import { beforeAll, describe, expect, it } from 'vitest'
import {
  DraftMismatchError,
  SUPPORTED_DRAFT,
  UnsupportedDraftError,
  UnsupportedKeywordError,
  merge,
  seedKeywordMap,
} from './index.js'
import type { KeywordShape } from './types.js'
import fixtureKeywords from './__fixtures__/draft-2020-12-keywords.json' assert { type: 'json' }

beforeAll(() => {
  seedKeywordMap(
    SUPPORTED_DRAFT,
    new Map(Object.entries(fixtureKeywords) as [string, KeywordShape][])
  )
})

function schema(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { $schema: SUPPORTED_DRAFT, type: 'object', ...overrides }
}

describe('merge()', () => {
  describe('preflight', () => {
    it('should reject mismatched $schema drafts', async () => {
      await expect(
        merge(
          { $schema: SUPPORTED_DRAFT, type: 'object' },
          { $schema: 'https://json-schema.org/draft-07/schema', type: 'object' }
        )
      ).rejects.toBeInstanceOf(DraftMismatchError)
    })

    it('should reject unsupported draft', async () => {
      await expect(
        merge(
          { $schema: 'https://json-schema.org/draft-07/schema', type: 'object' },
          { $schema: 'https://json-schema.org/draft-07/schema', type: 'object' }
        )
      ).rejects.toBeInstanceOf(UnsupportedDraftError)
    })

    it('should reject schemas containing unevaluatedProperties', async () => {
      await expect(
        merge(schema(), schema({ unevaluatedProperties: false }))
      ).rejects.toBeInstanceOf(UnsupportedKeywordError)
    })

    it('should reject schemas containing $dynamicRef', async () => {
      await expect(
        merge(schema(), schema({ $dynamicRef: '#meta' }))
      ).rejects.toBeInstanceOf(UnsupportedKeywordError)
    })

    it('should reject schemas containing $ref that is not local', async () => {
      await expect(
        merge(schema(), schema({ $ref: 'https://example.com/external' }))
      ).rejects.toThrow('Cannot inline non-local $ref')
    })

    it('should reject schemas containing not', async () => {
      await expect(
        merge(schema(), schema({ not: { type: 'string' } }))
      ).rejects.toBeInstanceOf(UnsupportedKeywordError)
    })
  })

  describe('type', () => {
    it('should union and dedupe type arrays', async () => {
      const result = await merge(
        schema({ type: 'object' }),
        schema({ type: ['object', 'null'] })
      )
      expect(result['type']).toEqual(['object', 'null'])
    })

    it('should dedupe identical type values', async () => {
      const result = await merge(schema({ type: 'object' }), schema({ type: 'object' }))
      expect(result['type']).toEqual(['object'])
    })

    it('should union two different scalar types', async () => {
      const result = await merge(
        schema({ type: 'string' }),
        schema({ type: 'null' })
      )
      expect(result['type']).toEqual(['object', 'string', 'null'])
    })
  })

  describe('required', () => {
    it('should union and dedupe required arrays', async () => {
      const result = await merge(
        schema({ required: ['id'] }),
        schema({ required: ['id', 'name'] })
      )
      expect(result['required']).toEqual(['id', 'name'])
    })

    it('should union disjoint required arrays', async () => {
      const result = await merge(
        schema({ required: ['a', 'b'] }),
        schema({ required: ['c'] })
      )
      expect(result['required']).toEqual(['a', 'b', 'c'])
    })
  })

  describe('properties', () => {
    it('should recursively merge nested properties', async () => {
      const result = await merge(
        schema({ properties: { id: { type: 'string' } } }),
        schema({ properties: { name: { type: 'string' } } })
      )
      expect(result['properties']).toEqual({
        id: { type: 'string' },
        name: { type: 'string' },
      })
    })

    it('should recursively merge overlapping property schemas', async () => {
      const result = await merge(
        schema({ properties: { id: { type: 'string', minLength: 1 } } }),
        schema({ properties: { id: { type: 'string', minLength: 5 } } })
      )
      expect((result['properties'] as Record<string, unknown>)['id']).toMatchObject({
        type: ['string'],
        minLength: 5,
      })
    })

    it('should preserve non-overlapping property from left schema', async () => {
      const result = await merge(
        schema({ properties: { foo: { type: 'boolean' }, bar: { type: 'number' } } }),
        schema({ properties: { baz: { type: 'string' } } })
      )
      const props = result['properties'] as Record<string, unknown>
      expect(props).toHaveProperty('foo')
      expect(props).toHaveProperty('bar')
      expect(props).toHaveProperty('baz')
    })
  })

  describe('numeric bounds', () => {
    it('should keep the stricter (larger) minLength', async () => {
      const result = await merge(schema({ minLength: 2 }), schema({ minLength: 8 }))
      expect(result['minLength']).toBe(8)
    })

    it('should keep the stricter (smaller) maxLength', async () => {
      const result = await merge(schema({ maxLength: 100 }), schema({ maxLength: 40 }))
      expect(result['maxLength']).toBe(40)
    })

    it('should keep the stricter minItems', async () => {
      const result = await merge(schema({ minItems: 1 }), schema({ minItems: 3 }))
      expect(result['minItems']).toBe(3)
    })

    it('should keep the stricter maxItems', async () => {
      const result = await merge(schema({ maxItems: 10 }), schema({ maxItems: 5 }))
      expect(result['maxItems']).toBe(5)
    })

    it('should keep the stricter minProperties', async () => {
      const result = await merge(schema({ minProperties: 1 }), schema({ minProperties: 4 }))
      expect(result['minProperties']).toBe(4)
    })

    it('should keep the stricter maxProperties', async () => {
      const result = await merge(schema({ maxProperties: 20 }), schema({ maxProperties: 8 }))
      expect(result['maxProperties']).toBe(8)
    })

    it('should keep the stricter minimum', async () => {
      const result = await merge(schema({ minimum: 0 }), schema({ minimum: 5 }))
      expect(result['minimum']).toBe(5)
    })

    it('should keep the stricter maximum', async () => {
      const result = await merge(schema({ maximum: 100 }), schema({ maximum: 50 }))
      expect(result['maximum']).toBe(50)
    })
  })

  describe('annotations', () => {
    it('should overwrite title with last-writer-wins', async () => {
      const result = await merge(schema({ title: 'First' }), schema({ title: 'Second' }))
      expect(result['title']).toBe('Second')
    })

    it('should overwrite description with last-writer-wins', async () => {
      const result = await merge(
        schema({ description: 'Old' }),
        schema({ description: 'New' })
      )
      expect(result['description']).toBe('New')
    })
  })

  describe('$defs', () => {
    it('should merge $defs by child key', async () => {
      const result = await merge(
        schema({ $defs: { Foo: { type: 'string' } } }),
        schema({ $defs: { Bar: { type: 'number' } } })
      )
      expect(result['$defs']).toEqual({
        Foo: { type: 'string' },
        Bar: { type: 'number' },
      })
    })

    it('should overwrite overlapping $defs key with last-writer-wins', async () => {
      const result = await merge(
        schema({ $defs: { Foo: { type: 'string' } } }),
        schema({ $defs: { Foo: { type: 'number' } } })
      )
      const defs = result['$defs'] as Record<string, unknown>
      // Foo is a plain object on both sides — mergeObjectMap recurses into it.
      // type 'string' + type 'number' → ['string', 'number']
      expect((defs['Foo'] as Record<string, unknown>)['type']).toEqual(['string', 'number'])
    })
  })

  describe('allOf / anyOf / oneOf', () => {
    it('should union allOf arrays', async () => {
      const result = await merge(
        schema({ allOf: [{ type: 'object' }] }),
        schema({ allOf: [{ required: ['id'] }] })
      )
      expect(result['allOf']).toEqual([{ type: 'object' }, { required: ['id'] }])
    })

    it('should union anyOf arrays', async () => {
      const result = await merge(
        schema({ anyOf: [{ type: 'string' }] }),
        schema({ anyOf: [{ type: 'null' }] })
      )
      expect(result['anyOf']).toEqual([{ type: 'string' }, { type: 'null' }])
    })

    it('should union oneOf arrays', async () => {
      const result = await merge(
        schema({ oneOf: [{ type: 'integer' }] }),
        schema({ oneOf: [{ type: 'string' }] })
      )
      expect(result['oneOf']).toEqual([{ type: 'integer' }, { type: 'string' }])
    })

    it('should dedupe identical allOf entries', async () => {
      const entry = { required: ['id'] }
      const result = await merge(
        schema({ allOf: [entry] }),
        schema({ allOf: [entry] })
      )
      expect(result['allOf']).toEqual([entry])
    })
  })

  describe('enum', () => {
    it('should union enum arrays', async () => {
      const result = await merge(
        schema({ enum: ['a', 'b'] }),
        schema({ enum: ['b', 'c'] })
      )
      expect(result['enum']).toEqual(['a', 'b', 'c'])
    })
  })

  describe('local $ref resolution', () => {
    it('should inline a local $ref before merging', async () => {
      const result = await merge(
        schema({
          $defs: { UserId: { type: 'string', minLength: 1 } },
          properties: { id: { $ref: '#/$defs/UserId' } },
        }),
        schema({
          properties: { name: { type: 'string' } },
        })
      )
      const props = result['properties'] as Record<string, unknown>
      expect(props['name']).toEqual({ type: 'string' })
      expect((props['id'] as Record<string, unknown>)['type']).toEqual('string')
      expect((props['id'] as Record<string, unknown>)['minLength']).toBe(1)
    })

    it('should throw on an unresolvable local $ref', async () => {
      await expect(
        merge(
          schema({ properties: { id: { $ref: '#/$defs/Missing' } } }),
          schema()
        )
      ).rejects.toThrow('Cannot resolve $ref')
    })
  })

  describe('if/then/else → allOf lift', () => {
    it('should lift if/then into allOf before merging', async () => {
      const result = await merge(
        schema({ if: { required: ['kind'] }, then: { properties: { kind: { type: 'string' } } } }),
        schema({ required: ['kind'] })
      )
      const allOf = result['allOf'] as unknown[]
      expect(Array.isArray(allOf)).toBe(true)
      expect(allOf.length).toBeGreaterThanOrEqual(1)
    })

    it('should lift if/then/else into two allOf entries', async () => {
      const result = await merge(
        schema({
          if: { properties: { type: { const: 'admin' } } },
          then: { required: ['adminKey'] },
          else: { required: ['userKey'] },
        }),
        schema()
      )
      const allOf = result['allOf'] as unknown[]
      expect(allOf.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('multi-schema merge', () => {
    it('should fold three schemas left to right', async () => {
      const result = await merge(
        schema({ required: ['id'], minProperties: 1 }),
        schema({ required: ['name'], minProperties: 2 }),
        schema({ required: ['email'], maxProperties: 10 })
      )
      expect(result['required']).toEqual(['id', 'name', 'email'])
      expect(result['minProperties']).toBe(2)
      expect(result['maxProperties']).toBe(10)
    })

    it('should fold four schemas preserving all numeric bounds', async () => {
      const result = await merge(
        schema({ minItems: 1 }),
        schema({ minItems: 3 }),
        schema({ minItems: 2 }),
        schema({ maxItems: 10 })
      )
      expect(result['minItems']).toBe(3)
      expect(result['maxItems']).toBe(10)
    })

    it('should fold three schemas and union all required fields', async () => {
      const result = await merge(
        schema({ required: ['a'] }),
        schema({ required: ['b'] }),
        schema({ required: ['c'] })
      )
      expect(result['required']).toEqual(['a', 'b', 'c'])
    })
  })
})
