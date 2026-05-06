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

// Pre-seed the keyword map so tests never hit the network.
const KEYWORD_FIXTURES: Record<string, KeywordShape> = {
  type: 'array',
  required: 'array',
  enum: 'array',
  examples: 'array',
  properties: 'object',
  patternProperties: 'object',
  $defs: 'object',
  title: 'string',
  description: 'string',
  default: 'unknown',
  minLength: 'number',
  maxLength: 'number',
  minItems: 'number',
  maxItems: 'number',
  minProperties: 'number',
  maxProperties: 'number',
  additionalProperties: 'unknown',
}

beforeAll(() => {
  seedKeywordMap(SUPPORTED_DRAFT, new Map(Object.entries(KEYWORD_FIXTURES)))
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

    it('should reject schemas containing $ref', async () => {
      await expect(
        merge(schema(), schema({ $ref: '#/$defs/Foo' }))
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
  })

  describe('required', () => {
    it('should union and dedupe required arrays', async () => {
      const result = await merge(
        schema({ required: ['id'] }),
        schema({ required: ['id', 'name'] })
      )
      expect(result['required']).toEqual(['id', 'name'])
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
  })
})
