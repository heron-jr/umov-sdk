import { describe, expect, it, vi } from 'vitest'
import { createLinkResources } from '../../src/resources/links'
import { createCustomEntitiesResource } from '../../src/resources/custom-entities'
import { createMixResource } from '../../src/resources/mix'
import { createFileResources } from '../../src/resources/files'
import { createSchedulesResource } from '../../src/resources/schedules'
import { parseCallbackJson, parseCallbackXml } from '../../src/webhook/parse'
import { Transport } from '../../src/core/transport'

const okXml = `<result><resourceName>x</resourceName><resourceId>1</resourceId></result>`
const listXml = `<result><size>0</size></result>`

function makeTransport(handler: (url: string) => string) {
  const fetchMock = vi.fn(async (url: string | URL) => new Response(handler(String(url)), { status: 200 }))
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { transport, fetchMock }
}

function call(fetchMock: ReturnType<typeof vi.fn>, n = 0) {
  const [url, init] = fetchMock.mock.calls[n]! as unknown as [string, RequestInit]
  const body = init?.body ? decodeURIComponent(String(init.body)).replace(/^data=/, '') : undefined
  return { url, method: init?.method, body }
}

describe('vínculos — deleteByPair', () => {
  it('scheduleItems.deleteByPair usa o path schedule/{alt}/item/{alt}', async () => {
    const { transport, fetchMock } = makeTransport(() => '<result/>')
    const links = createLinkResources(transport)
    await links.scheduleItems.deleteByPair({ scheduleAltId: 'OS 1', itemAltId: 'IT-2' })
    const { url, method } = call(fetchMock)
    expect(method).toBe('DELETE')
    expect(url).toContain('/scheduleItem/schedule/OS%201/item/IT-2.xml')
  })

  it('itineraryServiceLocals.deleteByPair usa itinerary/{alt}/serviceLocal/{alt}', async () => {
    const { transport, fetchMock } = makeTransport(() => '<result/>')
    const links = createLinkResources(transport)
    await links.itineraryServiceLocals.deleteByPair({ itineraryAltId: 'ROTA-1', linkedAltId: 'L-9' })
    expect(call(fetchMock).url).toContain('/itineraryServiceLocal/itinerary/ROTA-1/serviceLocal/L-9.xml')
  })

  it('sectionSubGroups.deleteByPair aceita id e altId intercambiáveis', async () => {
    const { transport, fetchMock } = makeTransport(() => '<result/>')
    const links = createLinkResources(transport)
    await links.sectionSubGroups.deleteByPair({ subGroup: 11, section: { altId: 'SEC-2' } })
    expect(call(fetchMock).url).toContain('/sectionSubGroup/11/SEC-2.xml')
  })

  it('batch de vínculo monta wrapper plural', async () => {
    const batchXml = `<result><size>1</size><entries><entry id="5" link="/agentActivity/5.xml"/></entries></result>`
    const { transport, fetchMock } = makeTransport(() => batchXml)
    const links = createLinkResources(transport)
    const stubs = await links.agentActivities.upsertBatch([
      { agent: { alternativeIdentifier: 'AG-1' }, activity: { alternativeIdentifier: 'ATV-1' } },
    ])
    const { url, body } = call(fetchMock)
    expect(url).toContain('/batch/agentActivities.xml')
    expect(body).toBe(
      '<agentActivities><agentActivity><agent><alternativeIdentifier>AG-1</alternativeIdentifier></agent><activity><alternativeIdentifier>ATV-1</alternativeIdentifier></activity></agentActivity></agentActivities>',
    )
    expect(stubs).toEqual([{ id: 5, link: '/agentActivity/5.xml' }])
  })
})

describe('customEntities.entries', () => {
  it('endereça entidade e entry por refs mistos', async () => {
    const detail = `<customEntityEntry><id>77</id><description>Reg</description></customEntityEntry>`
    const { transport, fetchMock } = makeTransport((u) => (u.includes('customEntityEntry/') ? detail : listXml))
    const ce = createCustomEntitiesResource(transport)
    await ce.entries({ altId: 'CAD-MIX' }).get(77)
    expect(call(fetchMock).url).toContain('/customEntity/alternativeIdentifier/CAD-MIX/customEntityEntry/77.xml')
  })

  it('create envia customFields com __', async () => {
    const { transport, fetchMock } = makeTransport(() => okXml)
    const ce = createCustomEntitiesResource(transport)
    await ce.entries(5).create({ description: 'R1', customFields: { 'campo com espaco': 'v' } })
    expect(call(fetchMock).body).toBe(
      '<customEntityEntry><description>R1</description><customFields><campo__com__espaco>v</campo__com__espaco></customFields></customEntityEntry>',
    )
  })

  it('upsertBatch exige entidade por altId', async () => {
    const { transport } = makeTransport(() => okXml)
    const ce = createCustomEntitiesResource(transport)
    await expect(ce.entries(5).upsertBatch([{ description: 'x', customFields: {} }])).rejects.toThrow(/altId/)
  })

  it('upsertBatch por altId usa o path documentado', async () => {
    const batchXml = `<result><size>1</size><entries><entry id="9" link="/x/9.xml"/></entries></result>`
    const { transport, fetchMock } = makeTransport(() => batchXml)
    const ce = createCustomEntitiesResource(transport)
    await ce.entries({ altId: 'CAD-1' }).upsertBatch([{ description: 'x', customFields: { a: '1' } }])
    const { url, body } = call(fetchMock)
    expect(url).toContain('/batch/customEntity/alternativeIdentifier/CAD-1/customEntityEntries.xml')
    expect(body).toContain('<customEntityEntries><customEntityEntry>')
  })

  describe('iterate', () => {
    const entryListXml = `<result><size>1</size><entries><entry id="77" link="/customEntityEntry/77.xml"/></entries></result>`
    const detail = `<customEntityEntry><id>77</id><description>Reg</description></customEntityEntry>`
    const route = (u: string) => (u.includes('customEntityEntry/77.xml') ? detail : entryListXml)

    it('sem hydrate rende stubs e para na página incompleta', async () => {
      const { transport, fetchMock } = makeTransport(route)
      const ce = createCustomEntitiesResource(transport)
      const out = []
      for await (const stub of ce.entries(5).iterate()) out.push(stub)
      expect(out).toEqual([{ id: 77, link: '/customEntityEntry/77.xml' }])
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('com hydrate rende entries completas via get', async () => {
      const { transport, fetchMock } = makeTransport(route)
      const ce = createCustomEntitiesResource(transport)
      const out = []
      for await (const entry of ce.entries(5).iterate({}, { hydrate: true })) out.push(entry)
      expect(out).toEqual([{ id: 77, description: 'Reg' }])
      expect(call(fetchMock, 1).url).toContain('/customEntity/5/customEntityEntry/77.xml')
    })
  })
})

describe('schedules — normalização de Date', () => {
  it('upsertBatch e create serializam Date como YYYY-MM-DD; route formata startTime', async () => {
    const batchXml = `<result><size>1</size><entries><entry id="1" link="/schedule/1.xml"/></entries></result>`
    const { transport, fetchMock } = makeTransport((u) => (u.includes('scheduleRouting') ? '<scheduleRouting/>' : batchXml))
    const schedules = createSchedulesResource(transport)

    await schedules.upsertBatch([
      { agent: { id: 1 }, serviceLocal: { id: 2 }, date: new Date(2026, 6, 15), hour: '09:00' },
    ])
    expect(call(fetchMock).body).toContain('<date>2026-07-15</date>')

    await schedules.route({
      origin: { geoCoordinate: '0,0' },
      schedules: [{ schedule: { id: 1 } }],
      startTime: new Date(2026, 6, 15, 8, 30, 0),
    })
    expect(call(fetchMock, 1).body).toContain('<startTime>2026-07-15 08:30:00</startTime>')
  })
})

describe('mix — falhas e retry', () => {
  it('ambiente sem mix lança erro claro e permite retry após configuração', async () => {
    const empty = `<result><size>0</size></result>`
    const discovery = `<result><size>3</size><entries><entry id="1" link="/customEntity/1.xml"/><entry id="2" link="/customEntity/2.xml"/><entry id="3" link="/customEntity/3.xml"/></entries></result>`
    const details: Record<string, string> = {
      '/customEntity/1.xml': `<customEntity><id>1</id><description>Tipo de Mix</description></customEntity>`,
      '/customEntity/2.xml': `<customEntity><id>2</id><description>Mix</description></customEntity>`,
      '/customEntity/3.xml': `<customEntity><id>3</id><description>Itens do Mix</description></customEntity>`,
    }
    let configured = false
    const { transport } = makeTransport((u) => {
      const detail = Object.keys(details).find((k) => u.includes(k))
      if (detail) return details[detail]!
      if (u.includes('structuralFunction=mix')) return configured ? discovery : empty
      return empty
    })
    const mix = createMixResource(createCustomEntitiesResource(transport))
    await expect(mix.items()).rejects.toThrow(/Mix não configurado/)
    configured = true
    // cache resetado na falha → retry funciona
    await expect(mix.items()).resolves.toBeDefined()
  })

  it('falha transiente de rede na descoberta não fica cacheada', async () => {
    let calls = 0
    const fetchMock = vi.fn(async (_url: string | URL) => {
      calls++
      if (calls === 1) throw new TypeError('fetch failed')
      if (String(_url).includes('structuralFunction=mix')) {
        return new Response(
          `<result><size>3</size><entries><entry id="1" link="/customEntity/1.xml"/><entry id="2" link="/customEntity/2.xml"/><entry id="3" link="/customEntity/3.xml"/></entries></result>`,
          { status: 200 },
        )
      }
      const id = /customEntity\/(\d)\.xml/.exec(String(_url))?.[1]
      const desc = { '1': 'Tipo de Mix', '2': 'Mix', '3': 'Itens do Mix' }[id ?? '1']
      return new Response(`<customEntity><id>${id}</id><description>${desc}</description></customEntity>`, { status: 200 })
    })
    const transport = new Transport({
      apiKey: 'k',
      requestsPerSecond: 1000,
      maxRetries: 0, // sem retry no transporte: força a rejeição chegar ao mix
      fetch: fetchMock as unknown as typeof fetch,
    })
    const mix = createMixResource(createCustomEntitiesResource(transport))
    await expect(mix.items()).rejects.toThrow()
    await expect(mix.items()).resolves.toBeDefined()
  })
})

describe('mix — descoberta cacheada', () => {
  function mixTransport() {
    const discovery = `<result><size>3</size><entries><entry id="1" link="/customEntity/1.xml"/><entry id="2" link="/customEntity/2.xml"/><entry id="3" link="/customEntity/3.xml"/></entries></result>`
    const details: Record<string, string> = {
      '/customEntity/1.xml': `<customEntity><id>1</id><description>Tipo de Mix</description></customEntity>`,
      '/customEntity/2.xml': `<customEntity><id>2</id><description>Mix</description></customEntity>`,
      '/customEntity/3.xml': `<customEntity><id>3</id><description>Itens do Mix</description></customEntity>`,
    }
    return makeTransport((u) => {
      const detail = Object.keys(details).find((k) => u.includes(k))
      if (detail) return details[detail]!
      if (u.includes('structuralFunction=mix')) return discovery
      return listXml
    })
  }

  it('resolve os 3 cadastros e cacheia a descoberta', async () => {
    const { transport, fetchMock } = mixTransport()
    const ce = createCustomEntitiesResource(transport)
    const mix = createMixResource(ce)
    await (await mix.items()).list()
    const callsAfterFirst = fetchMock.mock.calls.length
    await (await mix.types()).list()
    // segunda chamada não refaz a descoberta (1 discovery + 3 details na primeira)
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst + 1)
    const itemListUrl = String(fetchMock.mock.calls[4]![0])
    expect(itemListUrl).toContain('/customEntity/3/customEntityEntry.xml')
  })

  it('itemsOfMix filtra por mixItem_mix', async () => {
    const { transport, fetchMock } = mixTransport()
    const mix = createMixResource(createCustomEntitiesResource(transport))
    await mix.itemsOfMix(42)
    const urls = fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls.at(-1)).toContain('mixItem_mix=42')
  })
})

describe('importFiles', () => {
  it('monta o corpo com atributo name escapado', async () => {
    const { transport, fetchMock } = makeTransport(() => '<result/>')
    const { importFiles } = createFileResources(transport)
    await importFiles.schedule(['ITENS.csv', 'A&B.csv'])
    const { url, body } = call(fetchMock)
    expect(url).toContain('/importfiles.xml')
    expect(body).toBe('<import><files><entry name="ITENS.csv"/><entry name="A&amp;B.csv"/></files></import>')
  })
})

describe('schedules.route', () => {
  it('monta o corpo do roteirizador e valida máximo de 50', async () => {
    const routed = `<scheduleRouting><status>ok</status></scheduleRouting>`
    const { transport, fetchMock } = makeTransport(() => routed)
    const schedules = createSchedulesResource(transport)
    await schedules.route({
      origin: { agent: { id: 7 }, transportMode: 0 },
      schedules: [{ schedule: { alternativeIdentifier: 'OS-1' } }, { schedule: { id: 2 }, dependencies: [{ id: 1 }] }],
      estimate: true,
    })
    const { url, body } = call(fetchMock)
    expect(url).toContain('/scheduleRouting.xml')
    expect(body).toBe(
      '<scheduleRouting><estimate>true</estimate><origin><agent><id>7</id></agent><transportMode>0</transportMode></origin><schedules><schedule><alternativeIdentifier>OS-1</alternativeIdentifier></schedule><schedule><id>2</id><dependencies><schedule><id>1</id></schedule></dependencies></schedule></schedules></scheduleRouting>',
    )
    const many = Array.from({ length: 51 }, (_, i) => ({ schedule: { id: i } }))
    await expect(schedules.route({ origin: { geoCoordinate: '0,0' }, schedules: many })).rejects.toBeInstanceOf(RangeError)
  })
})

describe('webhook parsers', () => {
  it('parseCallbackXml extrai schedule e histories', () => {
    const xml = `<Schedule><alternativeIdentifier>OS-9</alternativeIdentifier><activityHistories><activityHistory id="11"/><activityHistory id="12"/></activityHistories></Schedule>`
    expect(parseCallbackXml(xml)).toEqual({
      scheduleAlternativeIdentifier: 'OS-9',
      activityHistoryIds: [11, 12],
    })
  })

  it('parseCallbackXml com um history só', () => {
    const xml = `<Schedule><alternativeIdentifier>OS-9</alternativeIdentifier><activityHistories><activityHistory id="11"/></activityHistories></Schedule>`
    expect(parseCallbackXml(xml).activityHistoryIds).toEqual([11])
  })

  it('parseCallbackXml aceita corpo form-encoded data= (formato real do POST da uMov.me)', () => {
    const xml = `<Schedule><alternativeIdentifier>OS-9</alternativeIdentifier><activityHistories><activityHistory id="11"/></activityHistories></Schedule>`
    const formBody = `data=${encodeURIComponent(xml)}`
    expect(parseCallbackXml(formBody)).toEqual({
      scheduleAlternativeIdentifier: 'OS-9',
      activityHistoryIds: [11],
    })
  })

  it('parseCallbackXml sem bloco activityHistories retorna lista vazia', () => {
    const xml = `<Schedule><alternativeIdentifier>OS-9</alternativeIdentifier></Schedule>`
    expect(parseCallbackXml(xml)).toEqual({
      scheduleAlternativeIdentifier: 'OS-9',
      activityHistoryIds: [],
    })
  })

  it('parseCallbackJson aceita string e objeto, normalizando números', () => {
    const payload = { historyId: '123', taskId: 9, clientId: 'C-1', activityId: '77' }
    expect(parseCallbackJson(JSON.stringify(payload))).toEqual({
      historyId: 123,
      taskId: 9,
      clientId: 'C-1',
      activityId: 77,
    })
    expect(() => parseCallbackJson({ historyId: 1 })).toThrow(/taskId/)
  })
})
