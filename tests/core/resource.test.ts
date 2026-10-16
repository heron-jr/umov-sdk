import { describe, expect, it, vi } from 'vitest'
import { defineResource, filtersToQuery } from '../../src/core/resource'
import { Transport } from '../../src/core/transport'

const listXml = `<result><size>1</size><entries><entry id="9" link="/widget/9.xml"/></entries></result>`
const detailXml = `<widget><id>9</id><name>W</name><active>true</active></widget>`
const writeXml = `<result><resourceName>widget</resourceName><resourceId>77</resourceId></result>`

interface Widget {
  id: number
  name: string
  active: boolean
}
interface WidgetCreate {
  name: string
  active?: boolean
}
interface WidgetFilters {
  name?: string
  active?: boolean
  initialInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

function makeResource(responses: Record<string, string>) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = String(url)
    const key = Object.keys(responses).find((k) => u.includes(k))
    if (!key) throw new Error(`sem mock para ${u}`)
    return new Response(responses[key]!, { status: 200 })
  })
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  const resource = defineResource<Widget, WidgetCreate, Partial<WidgetCreate>, WidgetFilters>(transport, {
    path: 'widget',
  })
  return { resource, fetchMock }
}

describe('filtersToQuery', () => {
  it('serializa booleanos, datas e raw', () => {
    expect(
      filtersToQuery({
        active: true,
        initialInsertDateTime: new Date(2026, 6, 1, 8, 0, 0),
        raw: { 'agentType.description': 'Tec' },
      }),
    ).toEqual({
      active: 'true',
      initialInsertDateTime: '2026-07-01 08:00:00',
      'agentType.description': 'Tec',
    })
  })
})

describe('defineResource', () => {
  it('list retorna página de stubs', async () => {
    const { resource } = makeResource({ 'widget.xml': listXml })
    const page = await resource.list()
    expect(page).toEqual({ size: 1, entries: [{ id: 9, link: '/widget/9.xml' }] })
  })

  it('list com page injeta paging.page', async () => {
    const { resource, fetchMock } = makeResource({ 'widget.xml': listXml })
    await resource.list({}, { page: 3 })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('paging.page=3')
  })

  it('get por id e por altId', async () => {
    const { resource, fetchMock } = makeResource({
      '/widget/9.xml': detailXml,
      'alternativeIdentifier/W-9.xml': detailXml,
    })
    await expect(resource.get(9)).resolves.toEqual({ id: 9, name: 'W', active: true })
    await expect(resource.get({ altId: 'W-9' })).resolves.toEqual({ id: 9, name: 'W', active: true })
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/widget/alternativeIdentifier/W-9.xml')
  })

  it('create POSTa na coleção e retorna id', async () => {
    const { resource, fetchMock } = makeResource({ 'widget.xml': writeXml })
    await expect(resource.create({ name: 'Novo' })).resolves.toEqual({ id: 77 })
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toContain('/widget.xml')
    expect(init.body).toBe(`data=${encodeURIComponent('<widget><name>Novo</name></widget>')}`)
  })

  it('update POSTa no path do ref', async () => {
    const { resource, fetchMock } = makeResource({ '/widget/9.xml': writeXml })
    await resource.update(9, { active: false })
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toContain('/widget/9.xml')
    expect(init.method).toBe('POST')
  })

  it('iterate hydrate=true resolve detalhes', async () => {
    const { resource } = makeResource({ '/widget/9.xml': detailXml, 'widget.xml': listXml })
    const out: Widget[] = []
    for await (const w of resource.iterate({}, { hydrate: true })) out.push(w)
    expect(out).toEqual([{ id: 9, name: 'W', active: true }])
  })

  it('iterate reenvia os filtros em todas as páginas', async () => {
    const entries100 = Array.from({ length: 100 }, (_, i) => `<entry id="${i + 1}" link="/widget/${i + 1}.xml"/>`).join('')
    const page1 = `<result><size>100</size><entries>${entries100}</entries></result>`
    const page2 = `<result><size>1</size><entries><entry id="101" link="/widget/101.xml"/></entries></result>`
    const fetchMock = vi.fn(async (url: string | URL) =>
      new Response(String(url).includes('paging.page=2') ? page2 : page1, { status: 200 }),
    )
    const transport = new Transport({
      apiKey: 'k',
      requestsPerSecond: 1000,
      fetch: fetchMock as unknown as typeof fetch,
    })
    const resource = defineResource<Widget, WidgetCreate, Partial<WidgetCreate>, WidgetFilters>(transport, {
      path: 'widget',
    })
    const ids: number[] = []
    for await (const s of resource.iterate({ active: true })) ids.push(s.id)
    expect(ids).toHaveLength(101)
    const secondUrl = String(fetchMock.mock.calls[1]![0])
    expect(secondUrl).toContain('active=true')
    expect(secondUrl).toContain('paging.page=2')
  })

  describe('exists', () => {
    it('true quando a primeira página tem entries', async () => {
      const { resource, fetchMock } = makeResource({ 'widget.xml': listXml })
      await expect(resource.exists({ active: true })).resolves.toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(String(fetchMock.mock.calls[0]![0])).toContain('active=true')
    })

    it('false quando a primeira página vem vazia', async () => {
      const { resource, fetchMock } = makeResource({ 'widget.xml': `<result><size>0</size></result>` })
      await expect(resource.exists()).resolves.toBe(false)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('não pagina além da primeira página, mesmo com página cheia', async () => {
      const entries100 = Array.from({ length: 100 }, (_, i) => `<entry id="${i + 1}" link="/widget/${i + 1}.xml"/>`).join('')
      const { resource, fetchMock } = makeResource({
        'widget.xml': `<result><size>100</size><entries>${entries100}</entries></result>`,
      })
      await expect(resource.exists()).resolves.toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
  })
})
