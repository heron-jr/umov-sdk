import { describe, expect, it, vi } from 'vitest'
import { UmovClient } from '../../src/client'
import { UmovV2Client } from '../../src/v2/client'
import { UmovConfigError } from '../../src/core/errors'

const fetchMock = () => vi.fn(async (_u: string | URL, _i?: RequestInit) => new Response('{"code":200,"id":"1"}', { status: 200 }))

describe('UmovClient + v2', () => {
  it('exige apiKey ou v2', () => {
    expect(() => new UmovClient({})).toThrow(/apiKey.*v2/)
    expect(() => new UmovClient({ apiKey: '' })).toThrow(/apiKey/)
  })

  it('só v1: umov.v2 lança UmovConfigError', () => {
    const umov = new UmovClient({ apiKey: 'k', fetch: fetchMock() as unknown as typeof fetch })
    expect(() => umov.v2).toThrow(UmovConfigError)
  })

  it('só v2: recursos v1 existem mas lançam UmovConfigError no uso', async () => {
    const f = fetchMock()
    const umov = new UmovClient({ v2: { appId: 1, appKey: 'ak' }, fetch: f as unknown as typeof fetch })
    expect(umov.v2).toBeInstanceOf(UmovV2Client)
    await expect(umov.agents.list()).rejects.toBeInstanceOf(UmovConfigError)
    expect(f).not.toHaveBeenCalled()
  })

  it('ambos: v2 herda fetch/logger do nível raiz e usa o host v2', async () => {
    const f = fetchMock()
    const logger = vi.fn()
    const umov = new UmovClient({
      apiKey: 'k',
      v2: { appId: 1, appKey: 'ak', requestsPerSecond: 1000 },
      fetch: f as unknown as typeof fetch,
      logger,
    })
    await umov.v2.transport.post('agents', { name: 'x' })
    expect(String(f.mock.calls[0]![0])).toBe('https://api.umov.me/v2/agents')
    expect(logger).toHaveBeenCalledWith(expect.objectContaining({ type: 'request', method: 'POST' }))
  })

  it('UmovV2Client avulso exige appId e appKey', () => {
    expect(() => new UmovV2Client({ appId: '', appKey: 'x' })).toThrow(UmovConfigError)
    expect(() => new UmovV2Client({ appId: 1, appKey: '' })).toThrow(UmovConfigError)
  })
})
