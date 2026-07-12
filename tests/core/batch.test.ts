import { describe, expect, it, vi } from 'vitest'
import { defineBatch, defineDelete } from '../../src/core/resource'
import { Transport } from '../../src/core/transport'

const batchResponse = `<result><resourceName>schedule</resourceName><size>2</size><entries><entry id="1" link="/schedule/1.xml"/><entry id="2" link="/schedule/2.xml"/></entries></result>`

function makeTransport(body: string) {
  const fetchMock = vi.fn(async (_url: string | URL) => new Response(body, { status: 200 }))
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { transport, fetchMock }
}

describe('defineBatch', () => {
  const cfg = { path: 'schedules', wrapper: 'schedules', itemRoot: 'schedule', max: 50 }

  it('serializa o lote com wrapper e POSTa em /batch/{path}.xml', async () => {
    const { transport, fetchMock } = makeTransport(batchResponse)
    const upsertBatch = defineBatch<{ alternativeIdentifier: string }>(transport, cfg)
    const stubs = await upsertBatch([{ alternativeIdentifier: 'OS-1' }, { alternativeIdentifier: 'OS-2' }])
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toContain('/batch/schedules.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe(
      '<schedules><schedule><alternativeIdentifier>OS-1</alternativeIdentifier></schedule><schedule><alternativeIdentifier>OS-2</alternativeIdentifier></schedule></schedules>',
    )
    expect(stubs).toEqual([
      { id: 1, link: '/schedule/1.xml' },
      { id: 2, link: '/schedule/2.xml' },
    ])
  })

  it('lança RangeError acima do máximo sem chunked', async () => {
    const { transport } = makeTransport(batchResponse)
    const upsertBatch = defineBatch<{ n: number }>(transport, cfg)
    const items = Array.from({ length: 51 }, (_, n) => ({ n }))
    await expect(upsertBatch(items)).rejects.toBeInstanceOf(RangeError)
  })

  it('chunked divide em lotes sequenciais (cada um atômico à parte)', async () => {
    const { transport, fetchMock } = makeTransport(batchResponse)
    const upsertBatch = defineBatch<{ n: number }>(transport, cfg)
    const items = Array.from({ length: 51 }, (_, n) => ({ n }))
    const stubs = await upsertBatch(items, { chunked: true })
    expect(fetchMock).toHaveBeenCalledTimes(2) // 50 + 1
    expect(stubs).toHaveLength(4) // 2 stubs mockados por lote
  })

  it('lote vazio não chama a API', async () => {
    const { transport, fetchMock } = makeTransport(batchResponse)
    const upsertBatch = defineBatch<{ n: number }>(transport, cfg)
    await expect(upsertBatch([])).resolves.toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('defineDelete', () => {
  it('DELETE por id interno apenas (API não documenta delete por altId avulso em vínculos)', async () => {
    const { transport, fetchMock } = makeTransport('<result/>')
    const del = defineDelete(transport, 'scheduleItem')
    await del(9)
    await del({ id: 12 })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/scheduleItem/9.xml')
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/scheduleItem/12.xml')
    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(init.method).toBe('DELETE')
  })
})
