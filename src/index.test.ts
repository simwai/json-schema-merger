import { describe, expect, it } from 'vitest'
import { DraftMismatchError, UnsupportedDraftError, UnsupportedKeywordError, merge } from './index.js'

const DRAFT = 'https://json-schema.org/draft/2020-12/schema'

function schema(overrides: Record<string, unknown> = {}) {
  return { $schema: DRAFT, type: 'object', ...overrides } as Record<string, unknown>
}

describe('merge()', () => {
  describe('preflight', () => {
    it('should reject mismatched $schema drafts', () => {
      expect(() =>
        merge(
          { $schema: DRAFT, type: 'object' },
          { $schema: 'https://json-schema.org/draft-07/schema', type: 'object' }
        )
      ).toThrow(DraftMismatchError)
    })

    it('should reject unsupported draft', () => {
      expect(() =>
        merge(
          { $schema: 'https://json-schema.org/draft-07/schema', type: 'object' },
          { $schema: 'https://json-schema.org/draft-07/schema', type: 'object' }
        )
      ).toThrow(UnsupportedDraftError)
    })

    it('should reject schemas containing unevaluatedProperties', () => {
      expect(() =>
        merge(schema(), schema({ unevaluatedProperties: false }))
      ).toThrow(UnsupportedKeywordError)
    })

    it('should reject schemas containing $dynamicRef', () => {
      expect(() =>
        merge(schema(), schema({ $dynamicRef: '#meta' }))
      ).toThrow(UnsupportedKeywordError)
    })

    it('should reject schemas containing $ref', () => {
      expect(() =>
        merge(schema(), schema({ $ref: '#/$defs/Foo' }))
      ).toThrow(UnsupportedKeywordError)
    })
  })

  describe('type', () => {
    it('should union and dedupe type arrays', () => {
      const result = merge(
        schema({ type: 'object' }),
        schema({ type: ['object', 'null'] })
      )
      expect(result['type']).toEqual(['object', 'null'])
    })

    it('should dedupe identical type values', () => {
      const result = merge(schema({ type: 'object' }), schema({ type: 'object' }))
      expect(result['type']).toEqual(['object'])
    })
  })

  describe('required', () => {
    it('should union and dedupe required arrays', () => {
      const result = merge(
        schema({ required: ['id'] }),
        schema({ required: ['id', 'name'] })
      )
      expect(result['required']).toEqual(['id', 'name'])
    })
  })

  describe('properties', () => {
    it('should recursively merge nested properties', () => {
      const result = merge(
        schema({ properties: { id: { type: 'string' } } }),
        schema({ properties: { name: { type: 'string' } } })
      )
      expect(result['properties']).toEqual({
        id: { type: 'string' },
        name: { type: 'string' },
      })
    })

    it('should recursively merge overlapping property schemas', () => {
      const result = merge(
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
    it('should keep the stricter (larger) minLength', () => {
      const result = merge(schema({ minLength: 2 }), schema({ minLength: 8 }))
      expect(result['minLength']).toBe(8)
    })

    it('should keep the stricter (smaller) maxLength', () => {
      const result = merge(schema({ maxLength: 100 }), schema({ maxLength: 40 }))
      expect(result['maxLength']).toBe(40)
    })

    it('should keep the stricter minItems', () => {
      const result = merge(schema({ minItems: 1 }), schema({ minItems: 3 }))
      expect(result['minItems']).toBe(3)
    })

    it('should keep the stricter maxItems', () => {
      const result = merge(schema({ maxItems: 10 }), schema({ maxItems: 5 }))
      expect(result['maxItems']).toBe(5)
    })
  })

  describe('annotations', () => {
    it('should overwrite title with last-writer-wins', () => {
      const result = merge(schema({ title: 'First' }), schema({ title: 'Second' }))
      expect(result['title']).toBe('Second')
    })

    it('should overwrite description with last-writer-wins', () => {
      const result = merge(
        schema({ description: 'Old description' }),
        schema({ description: 'New description' })
      )
      expect(result['description']).toBe('New description')
    })
  })

  describe('$defs', () => {
    it('should merge $defs by child key', () => {
      const result = merge(
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
    it('should fold three schemas left to right', () => {
      const result = merge(
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
