import { describe, expect, it, vi } from 'vitest'
import { iterateStubs, hydrateStubs } from '../../src/core/pagination'
import type { ListPage, ListStub } from '../../src/core/types'

const stub = (id: number): ListStub => ({ id, link: `/x/${id}.xml` })
const page = (ids: number[]): ListPage => ({ size: ids.length, entries: ids.map(stub) })

describe('iterateStubs', () => {
  it('auto: para quando a página vem menor que a primeira (ambiente de 100)', async () => {
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

  it('auto: ambiente de 25 — primeira página cheia com 25 NÃO encerra; segue até página menor', async () => {
    const fetchPage = vi
      .fn<(p: number) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(Array.from({ length: 25 }, (_, i) => i + 1)))
      .mockResolvedValueOnce(page(Array.from({ length: 25 }, (_, i) => i + 26)))
      .mockResolvedValueOnce(page([51, 52, 53]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toHaveLength(53)
    expect(fetchPage).toHaveBeenCalledTimes(3)
  })

  it('auto: primeira página com tamanho fora de 25/50/100 é a última (sem requisição extra)', async () => {
    const fetchPage = vi.fn(async () => page([1, 2, 3, 4, 5, 6, 7, 8]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toHaveLength(8)
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })

  it('auto: primeira página com exatamente 50 e fim dos dados custa uma requisição extra (vazia)', async () => {
    const fetchPage = vi
      .fn<(p: number) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => i + 1)))
      .mockResolvedValueOnce(page([]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toHaveLength(50)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('pageSize explícito: para na primeira página menor que ele, sem requisição extra', async () => {
    const fetchPage = vi
      .fn<(p: number) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(Array.from({ length: 50 }, (_, i) => i + 1)))
      .mockResolvedValueOnce(page([51, 52]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage, 50)) ids.push(s.id)
    expect(ids).toHaveLength(52)
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })

  it('pageSize explícito 100 em ambiente de 25: ainda assim NÃO trunca em página cheia de 25? (trunca — documentado)', async () => {
    // Configuração errada do consumidor: pageSize=100 mas o ambiente devolve 25 por página.
    // O SDK confia na configuração e para — por isso o default é a detecção automática.
    const fetchPage = vi.fn(async () => page(Array.from({ length: 25 }, (_, i) => i + 1)))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage, 100)) ids.push(s.id)
    expect(ids).toHaveLength(25)
    expect(fetchPage).toHaveBeenCalledTimes(1)
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

  it('propaga erro do get sem deixar rejections órfãs na janela', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => unhandled.push(reason)
    process.on('unhandledRejection', onUnhandled)
    try {
      async function* stubs() {
        yield stub(1)
        yield stub(2)
        yield stub(3)
        yield stub(4)
      }
      const get = vi.fn(async (id: number) => {
        if (id === 2) throw new Error('boom')
        if (id === 4) {
          await new Promise((r) => setTimeout(r, 5))
          throw new Error('late') // rejeição tardia na janela: precisa ser observada
        }
        return { id }
      })
      await expect(async () => {
        for await (const d of hydrateStubs(stubs(), get, 3)) void d
      }).rejects.toThrow('boom')
      await new Promise((r) => setTimeout(r, 20))
      expect(unhandled).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })
})

describe('iterateStubs — propagação de erro', () => {
  it('erro na página N rejeita o for-await com o mesmo erro', async () => {
    const fetchPage = vi
      .fn<(p: number) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => i + 1)))
      .mockRejectedValueOnce(new Error('api caiu'))
    await expect(async () => {
      for await (const s of iterateStubs(fetchPage)) void s
    }).rejects.toThrow('api caiu')
  })
})
