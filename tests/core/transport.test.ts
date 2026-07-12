import { afterEach, describe, expect, it, vi } from 'vitest'
import { Transport } from '../../src/core/transport'
import { UmovApiError, UmovAuthError, UmovRateLimitError } from '../../src/core/errors'

const API_KEY = 'a1b2c3d4e5f6a1b2c3d4'

function makeTransport(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return new Transport({
    apiKey: API_KEY,
    baseUrl: 'https://api.umov.me/CenterWeb/api',
    requestsPerSecond: 1000, // sem espera nos testes
    maxRetries: 2,
    timeoutMs: 5000,
    fetch: fetchImpl,
    ...extra,
  })
}

const ok = (body: string) => new Response(body, { status: 200 })

describe('Transport.get', () => {
  it('monta URL com apiKey no path e query encodada', async () => {
    const fetchMock = vi.fn(async () => ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await t.get('agent.xml', { name: 'Ana Souza', 'paging.page': '2', dateTime: '2026-07-12 09:00:00' })
    const [url] = fetchMock.mock.calls[0]! as unknown as [string]
    expect(url).toBe(
      `https://api.umov.me/CenterWeb/api/${API_KEY}/agent.xml?name=Ana%20Souza&paging.page=2&dateTime=2026-07-12%2009%3A00%3A00`,
    )
  })

  it('lança UmovAuthError em 401 com URL redigida', async () => {
    const fetchMock = vi.fn(async () => new Response('<error/>', { status: 401 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    const err = await t.get('agent.xml').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovAuthError)
    expect((err as UmovAuthError).url).not.toContain(API_KEY)
    expect((err as UmovAuthError).url).toContain('***')
    expect((err as UmovAuthError).message).not.toContain(API_KEY)
  })

  it('faz retry em 429 e sucede', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('esgota retries em 429 e lança UmovRateLimitError', async () => {
    const fetchMock = vi.fn(async () => new Response('rate', { status: 429 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).rejects.toBeInstanceOf(UmovRateLimitError)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })
})

describe('Transport.post', () => {
  it('envia XML como data= form-encoded', async () => {
    const fetchMock = vi.fn(async () => ok('<result><resourceId>1</resourceId></result>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await t.post('agent.xml', '<agent><name>Ana & Cia</name></agent>')
    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    )
    expect(init.body).toBe(`data=${encodeURIComponent('<agent><name>Ana & Cia</name></agent>')}`)
  })

  it('não faz retry de POST em 504 (não idempotente)', async () => {
    const fetchMock = vi.fn(async () => new Response('to', { status: 504 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.post('agent.xml', '<agent/>')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('faz retry de GET em 504', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('to', { status: 504 }))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>')
  })
})

describe('Transport — falha de rede', () => {
  it('GET retenta erro de rede e sucede', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('GET esgota retries de rede: UmovApiError status 0 com cause redigida', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError(`fetch failed for https://api.umov.me/CenterWeb/api/${API_KEY}/agent.xml`)
    })
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    const err = (await t.get('agent.xml').catch((e: unknown) => e)) as UmovApiError
    expect(err).toBeInstanceOf(UmovApiError)
    expect(err.status).toBe(0)
    expect(err.url).toContain('***')
    expect(err.responseBody).not.toContain(API_KEY)
    expect(err.responseBody).toContain('***')
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })

  it('POST NÃO retenta erro de rede (pode ter sido processado → duplicaria)', async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError('socket hang up')
    })
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.post('schedule.xml', '<schedule/>')).rejects.toBeInstanceOf(UmovApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('Transport — Retry-After', () => {
  afterEach(() => vi.useRealTimers())

  it('respeita Retry-After em segundos no 429', async () => {
    vi.useFakeTimers()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    const p = t.get('agent.xml')
    await vi.advanceTimersByTimeAsync(1900)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(200)
    await expect(p).resolves.toBe('<result/>')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('Retry-After não numérico (HTTP-date) cai no backoff exponencial', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('rate', { status: 429, headers: { 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' } }),
      )
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('Retry-After gigante é limitado por maxRetryDelayMs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate', { status: 429, headers: { 'Retry-After': '120' } }))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1, maxRetryDelayMs: 20 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>') // sem cap levaria 120s e estouraria o timeout do teste
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
