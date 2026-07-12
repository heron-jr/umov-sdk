import { describe, expect, it } from 'vitest'
import { refToPath } from '../../src/core/types'

describe('refToPath', () => {
  it('number vira path por id', () => {
    expect(refToPath(123)).toBe('123')
  })
  it('{id} vira path por id', () => {
    expect(refToPath({ id: 123 })).toBe('123')
  })
  it('string vira path por alternativeIdentifier', () => {
    expect(refToPath('OS-123')).toBe('alternativeIdentifier/OS-123')
  })
  it('{altId} vira path por alternativeIdentifier', () => {
    expect(refToPath({ altId: 'OS-123' })).toBe('alternativeIdentifier/OS-123')
  })
  it('encoda caracteres especiais no altId', () => {
    expect(refToPath({ altId: 'OS 12/3' })).toBe('alternativeIdentifier/OS%2012%2F3')
  })
})
