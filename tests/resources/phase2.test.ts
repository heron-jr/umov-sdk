import { describe, expect, it, vi } from 'vitest'
import { UmovClient } from '../../src/client'
import { createTeamsResource } from '../../src/resources/teams'
import { createMessagingResources } from '../../src/resources/messaging'
import { Transport } from '../../src/core/transport'

const okXml = `<result><resourceName>x</resourceName><resourceId>1</resourceId></result>`
const listXml = `<result><size>0</size></result>`

function makeTransport(body = okXml) {
  const fetchMock = vi.fn(async (_url: string | URL) => new Response(body, { status: 200 }))
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { transport, fetchMock }
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>, n = 0) {
  const [url, init] = fetchMock.mock.calls[n]! as unknown as [string, RequestInit]
  const body = init?.body ? decodeURIComponent(String(init.body)).replace(/^data=/, '') : undefined
  return { url, method: init?.method, body }
}

describe('client — wiring dos recursos das Fases 2+3', () => {
  it('expõe todos os recursos novos', () => {
    const { transport: _t, fetchMock } = makeTransport(listXml)
    const client = new UmovClient({ apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch })
    for (const r of [
      'agentTypes', 'teams', 'teamTypes', 'mathExpressions', 'logicalExpressions',
      'items', 'groups', 'subGroups', 'itemCategories', 'additionalInfoItems', 'sectionItems',
      'serviceLocalTypes', 'serviceLocalClassifications', 'local3Dimensions',
      'itineraries', 'agentActivities', 'scheduleItems', 'sectionSubGroups', 'serviceLocalActivities',
      'itineraryActivities', 'itineraryAgents', 'itineraryServiceLocals',
      'customEntities', 'mix', 'messages', 'pushNotifications', 'sms',
      'importFiles', 'importLayouts', 'exportLayouts',
    ] as const) {
      expect(client[r], r).toBeDefined()
    }
  })

  it('additionalInfoItems usa o path com a grafia da API (aditionalInfoItem)', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => new Response(listXml, { status: 200 }))
    const client = new UmovClient({ apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch })
    await client.additionalInfoItems.list()
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/aditionalInfoItem.xml')
  })
})

describe('teams — membros', () => {
  it('addMember POSTa agent com responsible no sub-path', async () => {
    const { transport, fetchMock } = makeTransport()
    const teams = createTeamsResource(transport)
    await teams.addMember({ altId: 'EQ-1' }, 42, { responsible: true })
    const { url, body } = lastCall(fetchMock)
    expect(url).toContain('/team/alternativeIdentifier/EQ-1/agent.xml')
    expect(body).toBe('<agent><id>42</id><responsible>true</responsible></agent>')
  })

  it('removeMember faz DELETE no vínculo', async () => {
    const { transport, fetchMock } = makeTransport('<result/>')
    const teams = createTeamsResource(transport)
    await teams.removeMember(7, 42)
    const { url, method } = lastCall(fetchMock)
    expect(url).toContain('/team/7/agent/42.xml')
    expect(method).toBe('DELETE')
  })
})

describe('mensageria', () => {
  it('messages.send monta recipients repetidos e valida 500 chars', async () => {
    const { transport, fetchMock } = makeTransport()
    const { messages } = createMessagingResources(transport)
    await messages.send({ recipients: ['a1', 'a2'], description: 'Oi', sendNotification: true })
    const { url, body } = lastCall(fetchMock)
    expect(url).toContain('/message.xml')
    expect(body).toBe(
      '<message><recipients><recipient><alternativeIdentifier>a1</alternativeIdentifier></recipient><recipient><alternativeIdentifier>a2</alternativeIdentifier></recipient></recipients><description>Oi</description><sendNotification>true</sendNotification></message>',
    )
    await expect(
      messages.send({ recipients: ['a1'], description: 'x'.repeat(501) }),
    ).rejects.toBeInstanceOf(RangeError)
  })

  it('pushNotifications.send monta agents repetidos', async () => {
    const { transport, fetchMock } = makeTransport()
    const { pushNotifications } = createMessagingResources(transport)
    await pushNotifications.send({ message: 'Alerta', agents: ['a1'] })
    const { url, body } = lastCall(fetchMock)
    expect(url).toContain('/scheduleNotification.xml')
    expect(body).toBe(
      '<scheduleNotification><message>Alerta</message><agents><agent><alternativeIdentifier>a1</alternativeIdentifier></agent></agents></scheduleNotification>',
    )
  })

  it('sms.send aceita os três alvos', async () => {
    const { transport, fetchMock } = makeTransport()
    const { sms } = createMessagingResources(transport)
    await sms.send({ to: { agentId: 9 }, message: 'oi', sendDownloadLink: false })
    expect(lastCall(fetchMock).body).toBe(
      '<smsRequest><agent><id>9</id></agent><message>oi</message><sendDownloadLink>false</sendDownloadLink></smsRequest>',
    )
    await sms.send({ to: { serviceLocalAltId: 'L-1' }, message: 'oi', sendDownloadLink: true })
    expect(lastCall(fetchMock, 1).body).toContain('<serviceLocal><alternativeIdentifier>L-1</alternativeIdentifier></serviceLocal>')
  })
})
