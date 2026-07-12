import { describe, expect, it, vi } from 'vitest'
import { createActivityHistoriesResource } from '../../src/resources/activity-histories'
import { Transport } from '../../src/core/transport'

const hierXml = `<activityHistory><id>5</id><status>50</status><activity><id>2</id><description>Vistoria</description></activity></activityHistory>`
const writeXml = `<result><resourceName>activityHistory</resourceName><resourceId>5</resourceId></result>`

function make(body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { histories: createActivityHistoriesResource(transport), fetchMock }
}

describe('activityHistories.hierarchical', () => {
  it('busca a árvore completa no endpoint próprio', async () => {
    const { histories, fetchMock } = make(hierXml)
    const tree = await histories.hierarchical(5)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/activityHistoryHierarchical/5.xml')
    expect(tree.id).toBe(5)
    expect((tree.activity as { description: string }).description).toBe('Vistoria')
  })
})

describe('activityHistories.createForSchedule', () => {
  it('POSTa no sub-path do schedule por altId', async () => {
    const { histories, fetchMock } = make(writeXml)
    await histories.createForSchedule({ altId: 'OS-1' }, { activity: { id: 2 } })
    const [url] = fetchMock.mock.calls[0]! as unknown as [string]
    expect(url).toContain('/schedule/alternativeIdentifier/OS-1/activityHistory.xml')
  })
})

describe('activityHistories.setApproval', () => {
  it('POSTa statusApproval no detalhe', async () => {
    const { histories, fetchMock } = make(writeXml)
    await histories.setApproval(5, 3)
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toContain('/activityHistory/5.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe('<activityHistory><statusApproval>3</statusApproval></activityHistory>')
  })
})

describe('activityHistories.setExportStatus', () => {
  it('POSTa executionExportStatus e exportFileName', async () => {
    const { histories, fetchMock } = make(writeXml)
    await histories.setExportStatus(5, { executionExportStatus: 'EXPORTED', exportFileName: 'lote1.csv' })
    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe(
      '<activityHistory><executionExportStatus>EXPORTED</executionExportStatus><exportFileName>lote1.csv</exportFileName></activityHistory>',
    )
  })
})
