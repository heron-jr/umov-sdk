import { describe, expect, it, vi } from 'vitest'
import { createCustomFieldsAccessor } from '../../src/resources/custom-fields'
import { Transport } from '../../src/core/transport'

const listXml = `<result><size>1</size><entries><entry id="3" link="/agent/1/customField/3.xml"/></entries></result>`
const writeXml = `<result><resourceName>customField</resourceName><resourceId>3</resourceId></result>`

function make(body: string) {
  const fetchMock = vi.fn(async (_url: string | URL) => new Response(body, { status: 200 }))
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { customFields: createCustomFieldsAccessor(transport), fetchMock }
}

describe('customFields.of(...).list', () => {
  it('lista valores no sub-path da entidade', async () => {
    const { customFields, fetchMock } = make(listXml)
    await customFields.of('agent', 1).list()
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/agent/1/customField.xml')
  })

  it('aceita ref por altId', async () => {
    const { customFields, fetchMock } = make(listXml)
    await customFields.of('serviceLocal', { altId: 'L-1' }).list()
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      '/serviceLocal/alternativeIdentifier/L-1/customField.xml',
    )
  })
})

describe('customFields.of(...).get', () => {
  it('lê um campo individual com valor', async () => {
    const detailXml = `<customField><id>3</id><description>Regiões</description><value>Sul</value></customField>`
    const { customFields, fetchMock } = make(detailXml)
    const field = await customFields.of('agent', 1).get({ altId: 'regioes' })
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      '/agent/1/customField/alternativeIdentifier/regioes.xml',
    )
    expect(field).toEqual({ id: 3, description: 'Regiões', value: 'Sul' })
  })
})

describe('customFields.of(...).setValues', () => {
  it('POSTa customFields com nomes encodados e pipe', async () => {
    const { customFields, fetchMock } = make(writeXml)
    await customFields.of('agent', 1).setValues({ 'numero da nota': '42', regioes: ['0', '1'] })
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toContain('/agent/1/customField.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe(
      '<customFields><numero__da__nota>42</numero__da__nota><regioes>0|1</regioes></customFields>',
    )
  })
})
