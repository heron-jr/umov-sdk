import { describe, expect, it, vi } from 'vitest'
import { UmovClient } from '../src/client'

const listXml = `<result><size>0</size></result>`

function makeClient() {
  const fetchMock = vi.fn(async (_url: string | URL) => new Response(listXml, { status: 200 }))
  const client = new UmovClient({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { client, fetchMock }
}

describe('UmovClient', () => {
  it('exige apiKey', () => {
    expect(() => new UmovClient({ apiKey: '' })).toThrow(/apiKey/)
  })

  it('expõe os recursos da Fase 1', () => {
    const { client } = makeClient()
    for (const r of [
      'agents',
      'serviceLocals',
      'schedules',
      'activities',
      'sections',
      'sectionFields',
      'activityHistories',
      'geoCoordinates',
      'customFields',
    ] as const) {
      expect(client[r]).toBeDefined()
    }
  })

  it('agents.list bate no path /agent.xml', async () => {
    const { client, fetchMock } = makeClient()
    await client.agents.list({ active: true })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/k/agent.xml?active=true')
  })

  it('sections.list usa filtro pontuado', async () => {
    const { client, fetchMock } = makeClient()
    await client.sections.list({ 'activity.description': 'Vistoria' })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('activity.description=Vistoria')
  })
})
