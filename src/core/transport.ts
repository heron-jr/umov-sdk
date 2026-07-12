import { errorFromStatus, UmovApiError } from './errors'
import { RateLimiter } from './rate-limit'

export interface UmovLogEvent {
  type: 'request' | 'retry' | 'error'
  method: string
  url: string // sempre redigida
  status?: number
  attempt?: number
}

export interface TransportOptions {
  apiKey: string
  baseUrl?: string
  requestsPerSecond?: number
  maxRetries?: number
  timeoutMs?: number
  retryBaseMs?: number
  /** Teto de espera para um Retry-After do servidor (default 60s). */
  maxRetryDelayMs?: number
  fetch?: typeof fetch
  logger?: (event: UmovLogEvent) => void
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

export class Transport {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly retryBaseMs: number
  private readonly maxRetryDelayMs: number
  private readonly fetchImpl: typeof fetch
  private readonly logger?: (event: UmovLogEvent) => void
  private readonly limiter: RateLimiter

  constructor(opts: TransportOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? 'https://api.umov.me/CenterWeb/api').replace(/\/$/, '')
    this.maxRetries = opts.maxRetries ?? 3
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.retryBaseMs = opts.retryBaseMs ?? 500
    this.maxRetryDelayMs = opts.maxRetryDelayMs ?? 60_000
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.logger = opts.logger
    this.limiter = new RateLimiter(opts.requestsPerSecond ?? 4)
  }

  /** Query encodada manualmente: espaço→%20 e ':'→%3A (exigência da doc; URLSearchParams usaria '+'). */
  private buildUrl(path: string, query?: Record<string, string>): string {
    let url = `${this.baseUrl}/${this.apiKey}/${path}`
    if (query && Object.keys(query).length > 0) {
      const qs = Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      url += `?${qs}`
    }
    return url
  }

  /** Token nunca aparece em logs/erros. */
  redact(url: string): string {
    return url.split(this.apiKey).join('***')
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    query?: Record<string, string>,
    body?: string,
  ): Promise<string> {
    const url = this.buildUrl(path, query)
    const redacted = this.redact(url)
    const init: RequestInit = { method }
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
      init.body = `data=${encodeURIComponent(body)}`
    }

    // POST não é idempotente na uMov.me (cria E atualiza): falha de rede/timeout após o envio
    // pode significar requisição já processada — nunca retentar. 429 é seguro (rejeitada antes).
    const idempotent = method === 'GET' || method === 'DELETE'

    for (let attempt = 0; ; attempt++) {
      await this.limiter.acquire()
      this.logger?.({ type: 'request', method, url: redacted, attempt })

      let res: Response
      let text: string
      try {
        res = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
        text = await res.text()
      } catch (cause) {
        if (idempotent && attempt < this.maxRetries) {
          this.logger?.({ type: 'retry', method, url: redacted, attempt })
          await sleep(this.retryBaseMs * 2 ** attempt)
          continue
        }
        throw new UmovApiError(0, { method, url: redacted, responseBody: this.redact(String(cause)) }, 'falha de rede/timeout')
      }

      if (res.ok) return text

      const retryable = res.status === 429 || (res.status === 504 && idempotent)
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, this.maxRetryDelayMs)
            : this.retryBaseMs * 2 ** attempt
        this.logger?.({ type: 'retry', method, url: redacted, status: res.status, attempt })
        await sleep(wait)
        continue
      }

      this.logger?.({ type: 'error', method, url: redacted, status: res.status, attempt })
      throw errorFromStatus(res.status, { method, url: redacted, responseBody: this.redact(text) })
    }
  }

  get(path: string, query?: Record<string, string>): Promise<string> {
    return this.request('GET', path, query)
  }

  post(path: string, xmlBody: string): Promise<string> {
    return this.request('POST', path, undefined, xmlBody)
  }

  delete(path: string): Promise<string> {
    return this.request('DELETE', path)
  }
}
