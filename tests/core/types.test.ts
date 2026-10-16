import { describe, expect, expectTypeOf, it } from 'vitest'
import { refToPath } from '../../src/core/types'
import type { ScheduleFilters } from '../../src/resources/types'

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

describe('ScheduleFilters', () => {
  it('aceita os filtros de uso real em produção', () => {
    const filtros = {
      'scheduleType.alternativeIdentifier': 'FUNERAL',
      initialExecutionDate: new Date('2026-10-14T00:00:00'),
      finalExecutionDate: '2026-10-15 00:00:00',
      active: true,
      alternativeIdentifier: 'OS-1',
    } satisfies ScheduleFilters
    expect(Object.keys(filtros)).toHaveLength(5)
  })

  it('tipa as chaves de fato (sem cair no index signature unknown)', () => {
    expectTypeOf<ScheduleFilters['scheduleType.alternativeIdentifier']>().toEqualTypeOf<string | undefined>()
    expectTypeOf<ScheduleFilters['initialExecutionDate']>().toEqualTypeOf<Date | string | undefined>()
    expectTypeOf<ScheduleFilters['finalExecutionDate']>().toEqualTypeOf<Date | string | undefined>()
    expectTypeOf<ScheduleFilters['active']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<ScheduleFilters['alternativeIdentifier']>().toEqualTypeOf<string | undefined>()
  })
})
