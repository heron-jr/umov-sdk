import { describe, expect, it, vi } from 'vitest'
import { getToken } from '../../src/core/token'
import { UmovClient } from '../../src/client'
import { UmovAuthError } from '../../src/core/errors'

const okBody = `<result><statusCode>200</statusCode><message>abc123def456</message></result>`
const failBody = `<result><statusCode>401</statusCode><error>authentication.error.login.fail</error></result>`

describe('getToken', () => {
  it('POSTa apiToken form-encoded e extrai o token de <message>', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => new Response(okBody, { status: 200 }))
    const token = await getToken({
      login: 'master',
      password: 'p&ss',
      domain: 'laivon',
      fetch: fetchMock as unknown as typeof fetch,
    })
    expect(token).toBe('abc123def456')
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('https://api.umov.me/CenterWeb/api/token.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe(
      '<apiToken><login>master</login><password><![CDATA[p%26ss]]></password><domain>laivon</domain></apiToken>',
    )
  })

  it('credencial errada vira UmovAuthError com o <error> singular da API', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => new Response(failBody, { status: 401 }))
    const err = await getToken({
      login: 'x',
      password: 'y',
      domain: 'laivon',
      fetch: fetchMock as unknown as typeof fetch,
    }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovAuthError)
    expect((err as UmovAuthError).apiErrors).toBe('authentication.error.login.fail')
  })

  it('resposta sem <message> lança erro claro', async () => {
    const fetchMock = vi.fn(async (_url: string | URL) => new Response('<result/>', { status: 200 }))
    await expect(
      getToken({ login: 'x', password: 'y', domain: 'z', fetch: fetchMock as unknown as typeof fetch }),
    ).rejects.toThrow(/message/)
  })
})

describe('UmovClient.fromCredentials', () => {
  it('autentica e retorna cliente funcional com o token obtido', async () => {
    const listXml = `<result><size>0</size></result>`
    const fetchMock = vi.fn(async (url: string | URL) =>
      new Response(String(url).endsWith('/token.xml') ? okBody : listXml, { status: 200 }),
    )
    const client = await UmovClient.fromCredentials({
      login: 'master',
      password: 'x',
      domain: 'laivon',
      requestsPerSecond: 1000,
      fetch: fetchMock as unknown as typeof fetch,
    })
    await client.agents.list()
    const agentUrl = String(fetchMock.mock.calls[1]![0])
    expect(agentUrl).toContain('/abc123def456/agent.xml')
  })
})
