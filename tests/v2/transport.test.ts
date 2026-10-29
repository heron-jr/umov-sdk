import { describe, expect, it, vi } from 'vitest'
import { parseV2Envelope, TransportV2 } from '../../src/v2/transport'
import { UmovAuthError, UmovNotFoundError, UmovRateLimitError, UmovValidationError } from '../../src/core/errors'

const APP_KEY = '00000000-0000-4000-8000-000000000000'

function makeTransport(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return new TransportV2({
    appId: 2,
    appKey: APP_KEY,
    requestsPerSecond: 1000,
    maxRetries: 2,
    retryBaseMs: 1,
    fetch: fetchImpl,
    ...extra,
  })
}

const ok = (body: string, status = 200) => new Response(body, { status })
const json = (obj: unknown, status = 200) => ok(JSON.stringify(obj), status)

describe('parseV2Envelope', () => {
  it('normaliza code/id/messages; id numérico vira number', () => {
    const r = parseV2Envelope(200, '{"code":200,"id":"123","operationMessages":[{"key":"created","value":"ok"}]}')
    expect(r).toEqual({ code: 200, id: 123, rawId: '123', messages: [{ key: 'created', value: 'ok' }] })
  })

  it('id não numérico fica só em rawId', () => {
    const r = parseV2Envelope(200, '{"code":200,"id":"ABC-1"}')
    expect(r.id).toBeUndefined()
    expect(r.rawId).toBe('ABC-1')
  })

  it('corpo vazio é sucesso sem dados; não-JSON vai para raw', () => {
    expect(parseV2Envelope(200, '')).toEqual({ code: 200, messages: [] })
    expect(parseV2Envelope(200, 'OK')).toEqual({ code: 200, messages: [], raw: 'OK' })
  })
})

describe('TransportV2.request', () => {
  it('envia headers AppId/AppKey e JSON no body', async () => {
    const fetchMock = vi.fn(async (_u: string | URL, _i?: RequestInit) => json({ code: 200, id: 7 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    const res = await t.post('agents', { name: 'Ana', active: true, skip: undefined })
    expect(res.id).toBe(7)
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toBe('https://api.umov.me/v2/agents')
    const headers = init.headers as Record<string, string>
    expect(headers.AppId).toBe('2')
    expect(headers.AppKey).toBe(APP_KEY)
    expect(headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"name":"Ana","active":true}')
  })

  it('aceita path com barra inicial e baseUrl com barra final', async () => {
    const fetchMock = vi.fn(async (_u: string | URL, _i?: RequestInit) => ok(''))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { baseUrl: 'https://x.test/v2/' })
    await t.delete('/agentType/5')
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://x.test/v2/agentType/5')
    expect((fetchMock.mock.calls[0]![1] as RequestInit).body).toBeUndefined()
  })

  it('POST sem body envia {} (a API rejeita corpo vazio com "bad body message")', async () => {
    const fetchMock = vi.fn(async (_u: string | URL, _i?: RequestInit) => ok(''))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await t.post('team/1/agent/2')
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.body).toBe('{}')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('400 vira UmovValidationError com messages/keys/hasKey', async () => {
    const body = { code: 400, operationMessages: [{ key: 'field_required:accessRole', value: 'Campo deve ser preenchido' }] }
    const fetchMock = vi.fn(async () => json(body, 400))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    const err = await t.post('agents', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovValidationError)
    const e = err as UmovValidationError
    expect(e.keys).toEqual(['field_required:accessRole'])
    expect(e.hasKey('field_required')).toBe(true)
    expect(e.hasKey('field_required:accessRole')).toBe(true)
    expect(e.hasKey('field_req')).toBe(false)
    expect(e.message).toContain('field_required:accessRole')
  })

  it('HTTP 200 com code 400 no envelope vira UmovValidationError (comportamento real de /tasks/prioritize)', async () => {
    const body = { code: 400, operationMessages: [{ key: 'error.prioritizeTasks', value: 'Error when priorityzing tasks' }] }
    const t = makeTransport(vi.fn(async () => json(body, 200)) as unknown as typeof fetch)
    const err = await t.patch('tasks/prioritize', [{ id: 1 }]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovValidationError)
    expect((err as UmovValidationError).status).toBe(400)
    expect((err as UmovValidationError).keys).toEqual(['error.prioritizeTasks'])
  })

  it('401 → UmovAuthError, 404 → UmovNotFoundError', async () => {
    const t401 = makeTransport(vi.fn(async () => json({ code: 401 }, 401)) as unknown as typeof fetch)
    await expect(t401.post('agents', {})).rejects.toBeInstanceOf(UmovAuthError)
    const t404 = makeTransport(vi.fn(async () => json({ code: 404 }, 404)) as unknown as typeof fetch)
    await expect(t404.patch('agents/1', {})).rejects.toBeInstanceOf(UmovNotFoundError)
  })

  it('redige a AppKey do corpo de erro', async () => {
    const fetchMock = vi.fn(async () => ok(`bad key ${APP_KEY}`, 400))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    const err = (await t.post('agents', {}).catch((e: unknown) => e)) as UmovValidationError
    expect(err.responseBody).toBe('bad key ***')
  })

  it('retenta 429 respeitando Retry-After e sucede', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'Retry-After': '0' } }))
      .mockResolvedValueOnce(json({ code: 200 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await expect(t.post('agents', {})).resolves.toEqual({ code: 200, messages: [] })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('esgota retries em 429 → UmovRateLimitError', async () => {
    const fetchMock = vi.fn(async () => ok('', 429))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await expect(t.post('agents', {})).rejects.toBeInstanceOf(UmovRateLimitError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('504: retenta PATCH (idempotente) mas não POST', async () => {
    const patchFetch = vi.fn().mockResolvedValueOnce(ok('', 504)).mockResolvedValueOnce(json({ code: 200 }))
    await expect(makeTransport(patchFetch as unknown as typeof fetch).patch('agents/1', {})).resolves.toBeTruthy()
    expect(patchFetch).toHaveBeenCalledTimes(2)

    const postFetch = vi.fn(async () => ok('', 504))
    await expect(makeTransport(postFetch as unknown as typeof fetch).post('agents', {})).rejects.toThrow()
    expect(postFetch).toHaveBeenCalledTimes(1)
  })

  it('falha de rede: retenta DELETE, não POST', async () => {
    const delFetch = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET')).mockResolvedValueOnce(ok(''))
    await expect(makeTransport(delFetch as unknown as typeof fetch).delete('tags/1')).resolves.toBeTruthy()
    expect(delFetch).toHaveBeenCalledTimes(2)

    const postFetch = vi.fn(async () => {
      throw new Error('ECONNRESET')
    })
    await expect(makeTransport(postFetch as unknown as typeof fetch).post('tags', {})).rejects.toThrow(/rede/)
    expect(postFetch).toHaveBeenCalledTimes(1)
  })

  it('envia FormData sem Content-Type JSON', async () => {
    const fetchMock = vi.fn(async (_u: string | URL, _i?: RequestInit) => json({ code: 200 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    const fd = new FormData()
    fd.append('description', 'foto')
    await t.post('media', fd)
    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.body).toBe(fd)
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })
})
