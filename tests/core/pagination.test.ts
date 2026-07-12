import { describe, expect, it, vi } from 'vitest'
import { iterateStubs, hydrateStubs } from '../../src/core/pagination'
import type { ListPage, ListStub } from '../../src/core/types'

const stub = (id: number): ListStub => ({ id, link: `/x/${id}.xml` })
const page = (ids: number[]): ListPage => ({ size: ids.length, entries: ids.map(stub) })

describe('iterateStubs', () => {
  it('para quando a página vem com menos de 100 entradas', async () => {
    const fetchPage = vi
      .fn<(p: number) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => i + 1)))
      .mockResolvedValueOnce(page([101, 102]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toHaveLength(102)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2)
  })

  it('para imediatamente em página vazia', async () => {
    const fetchPage = vi.fn(async () => page([]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})

describe('hydrateStubs', () => {
  it('resolve detalhes preservando a ordem', async () => {
    async function* stubs() {
      yield stub(1)
      yield stub(2)
      yield stub(3)
    }
    const get = vi.fn(async (id: number) => ({ id, name: `n${id}` }))
    const out: Array<{ id: number; name: string }> = []
    for await (const d of hydrateStubs(stubs(), get, 2)) out.push(d)
    expect(out.map((d) => d.id)).toEqual([1, 2, 3])
  })
})
