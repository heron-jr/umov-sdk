import { vi } from 'vitest'
import { TransportV2 } from '../../src/v2/transport'

export interface RecordedCall {
  method: string | undefined
  path: string
  body: unknown
}

/**
 * Transporte v2 com fetch mockado. `calls()` devolve método, path relativo ao host e body (JSON parseado,
 * ou o FormData cru) de cada requisição, na ordem.
 */
export function mockTransport() {
  const fetchMock = vi.fn(async (_u: string | URL, _i?: RequestInit) =>
    new Response('{"code":200,"id":"1"}', { status: 200 }),
  )
  const transport = new TransportV2({
    appId: 1,
    appKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  const calls = (): RecordedCall[] =>
    fetchMock.mock.calls.map(([url, init]) => ({
      method: init?.method,
      path: String(url).replace('https://api.umov.me/v2/', ''),
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
    }))
  const last = (): RecordedCall => calls().at(-1)!
  return { transport, fetchMock, calls, last }
}
