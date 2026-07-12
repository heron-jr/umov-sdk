import { describe, expect, it } from 'vitest'
import { formatDateTime, formatDate } from '../../src/util/datetime'

describe('formatDateTime', () => {
  it('formata Date como YYYY-MM-DD HH:MM:SS (hora local)', () => {
    expect(formatDateTime(new Date(2026, 6, 12, 9, 5, 3))).toBe('2026-07-12 09:05:03')
  })
  it('deixa string passar intacta', () => {
    expect(formatDateTime('2026-07-12 09:05:03')).toBe('2026-07-12 09:05:03')
  })
})

describe('formatDate', () => {
  it('formata Date como YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 6, 2))).toBe('2026-07-02')
  })
})
