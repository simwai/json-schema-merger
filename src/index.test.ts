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
      expect(result['type']).toEqual(['string', 'null'])
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

    it('should recursively merge overlapping $defs entries', async () => {
      const result = await merge(
        schema({ $defs: { Foo: { type: 'string' } } }),
        schema({ $defs: { Foo: { type: 'number' } } })
      )
      const defs = result['$defs'] as Record<string, unknown>
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
          schema({
            $defs: {},
            properties: { id: { $ref: '#/$defs/Missing' } },
          }),
          schema()
        )
      ).rejects.toThrow('Cannot resolve $ref')
    })

    it('should inline a $ref and apply stricter numeric bounds from the other schema', async () => {
      const result = await merge(
        schema({
          $defs: { Age: { type: 'integer', minimum: 0, maximum: 150 } },
          properties: { age: { $ref: '#/$defs/Age' } },
        }),
        schema({
          properties: { age: { type: 'integer', minimum: 18, maximum: 120 } },
        })
      )
      const age = (result['properties'] as Record<string, unknown>)['age'] as Record<string, unknown>
      expect(age['minimum']).toBe(18)
      expect(age['maximum']).toBe(120)
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

    it('should union lifted allOf with existing allOf from the other schema', async () => {
      const result = await merge(
        schema({
          if: { required: ['isAdmin'] },
          then: { properties: { permissions: { type: 'array' } } },
        }),
        schema({ allOf: [{ required: ['id'] }] })
      )
      const allOf = result['allOf'] as unknown[]
      expect(allOf.length).toBeGreaterThanOrEqual(2)
      const hasRequired = allOf.some(
        (e) => JSON.stringify(e) === JSON.stringify({ required: ['id'] })
      )
      expect(hasRequired).toBe(true)
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

  describe('integration', () => {
    it('should merge two realistic user schemas end-to-end', async () => {
      const base = schema({
        title: 'User base',
        required: ['id', 'email'],
        minProperties: 2,
        properties: {
          id:    { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' },
          role:  { type: 'string', enum: ['viewer', 'editor'] },
        },
        $defs: {
          NonEmptyString: { type: 'string', minLength: 1 },
        },
      })

      const extension = schema({
        title: 'User extended',
        required: ['id', 'name'],
        minProperties: 3,
        maxProperties: 20,
        properties: {
          id:   { type: 'string', minLength: 5 },
          name: { $ref: '#/$defs/NonEmptyString' },
          role: { type: 'string', enum: ['editor', 'admin'] },
        },
        $defs: {
          NonEmptyString: { type: 'string', minLength: 1 },
        },
      })

      const result = await merge(base, extension)

      expect(result['title']).toBe('User extended')
      expect(result['required']).toEqual(['id', 'email', 'name'])
      expect(result['minProperties']).toBe(3)
      expect(result['maxProperties']).toBe(20)

      const props = result['properties'] as Record<string, Record<string, unknown>>
      expect(props['id']['minLength']).toBe(5)
      expect(Array.isArray(props['id']['type'])).toBe(true)
      expect(props['email']['format']).toBe('email')
      expect(props['name']).toBeDefined()

      const role = props['role']
      const roleEnum = role['enum'] as string[]
      expect(roleEnum).toContain('viewer')
      expect(roleEnum).toContain('editor')
      expect(roleEnum).toContain('admin')
    })

    it('should merge three product schemas accumulating all constraints', async () => {
      const core = schema({
        required: ['sku', 'price'],
        properties: {
          sku:   { type: 'string', minLength: 3, maxLength: 20 },
          price: { type: 'number', minimum: 0 },
        },
      })

      const inventory = schema({
        required: ['stock'],
        properties: {
          sku:   { type: 'string', minLength: 6 },
          stock: { type: 'integer', minimum: 0 },
        },
      })

      const marketplace = schema({
        required: ['sellerId'],
        maxProperties: 15,
        properties: {
          price:    { type: 'number', minimum: 0.01, maximum: 99999 },
          sellerId: { type: 'string', minLength: 8 },
        },
      })

      const result = await merge(core, inventory, marketplace)

      expect(result['required']).toEqual(['sku', 'price', 'stock', 'sellerId'])
      expect(result['maxProperties']).toBe(15)

      const props = result['properties'] as Record<string, Record<string, unknown>>
      expect(props['sku']['minLength']).toBe(6)
      expect(props['sku']['maxLength']).toBe(20)
      expect(props['price']['minimum']).toBe(0.01)
      expect(props['price']['maximum']).toBe(99999)
      expect(props['stock']).toBeDefined()
      expect(props['sellerId']['minLength']).toBe(8)
    })

    it('should handle $defs shared across schemas with overlapping definitions', async () => {
      const a = schema({
        $defs: {
          Status: { type: 'string', enum: ['active', 'inactive'] },
          Tag:    { type: 'string', minLength: 1, maxLength: 32 },
        },
        properties: {
          status: { $ref: '#/$defs/Status' },
        },
      })

      const b = schema({
        $defs: {
          Status: { type: 'string', enum: ['active', 'pending', 'archived'] },
          Tag:    { type: 'string', minLength: 2, maxLength: 64 },
        },
        properties: {
          tag: { $ref: '#/$defs/Tag' },
        },
      })

      const result = await merge(a, b)

      const defs = result['$defs'] as Record<string, Record<string, unknown>>
      const statusEnum = defs['Status']['enum'] as string[]
      expect(statusEnum).toContain('active')
      expect(statusEnum).toContain('inactive')
      expect(statusEnum).toContain('pending')
      expect(statusEnum).toContain('archived')

      expect(defs['Tag']['minLength']).toBe(2)
      expect(defs['Tag']['maxLength']).toBe(32)

      const props = result['properties'] as Record<string, Record<string, unknown>>
      expect(props['status']).toBeDefined()
      expect(props['tag']).toBeDefined()
    })

    it('should lift if/then from one schema and union its allOf with the other', async () => {
      const conditional = schema({
        if:   { properties: { role: { const: 'admin' } } },
        then: { required: ['adminToken'] },
        else: { required: ['userToken'] },
        properties: { role: { type: 'string' } },
      })

      const base = schema({
        required: ['id'],
        allOf: [{ minProperties: 2 }],
        properties: { id: { type: 'string' } },
      })

      const result = await merge(conditional, base)

      expect(result['required']).toContain('id')

      const allOf = result['allOf'] as unknown[]
      expect(Array.isArray(allOf)).toBe(true)
      expect(allOf.length).toBeGreaterThanOrEqual(3)

      const props = result['properties'] as Record<string, unknown>
      expect(props).toHaveProperty('role')
      expect(props).toHaveProperty('id')
    })
  })
})
