import { errorFromStatus, UmovApiError } from '../core/errors'
import { RateLimiter } from '../core/rate-limit'
import type { UmovLogEvent } from '../core/transport'
import type { V2Message, V2Result } from './types'

export interface TransportV2Options {
  /** Único por ambiente uMov.me (inteiro). Não é segredo. */
  appId: number | string
  /** Token da API 2.0 — gerido pelo suporte uMov.me. Redigido em logs e erros. */
  appKey: string
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

export type V2Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

/**
 * Normaliza o envelope `ApiReturn { code, id, operationMessages }` (docs/api-v2.md §4).
 * Corpo vazio é sucesso sem dados; corpo não-JSON é preservado em `raw`.
 */
export function parseV2Envelope(status: number, text: string): V2Result {
  const trimmed = text.trim()
  if (trimmed === '') return { code: status, messages: [] }
  let doc: unknown
  try {
    doc = JSON.parse(trimmed)
  } catch {
    return { code: status, messages: [], raw: text }
  }
  if (!doc || typeof doc !== 'object') return { code: status, messages: [], raw: text }
  const d = doc as { code?: unknown; id?: unknown; operationMessages?: unknown }
  const messages: V2Message[] = Array.isArray(d.operationMessages)
    ? d.operationMessages
        .filter((m): m is { key?: unknown; value?: unknown } => !!m && typeof m === 'object')
        .map((m) => ({ key: String(m.key ?? ''), value: String(m.value ?? '') }))
    : []
  const result: V2Result = { code: typeof d.code === 'number' ? d.code : status, messages }
  if (d.id !== undefined && d.id !== null) {
    const rawId = String(d.id)
    result.rawId = rawId
    if (/^\d+$/.test(rawId)) result.id = Number(rawId)
  }
  return result
}

/**
 * Transporte da API 2.0: JSON com headers `AppId`/`AppKey` (docs/api-v2.md §2).
 * Mesmo retry/backoff do v1: 429 sempre; 504 e falha de rede só em métodos idempotentes.
 * POST nunca é retentado depois de enviado — pode já ter criado o recurso.
 */
export class TransportV2 {
  private readonly appId: string
  private readonly appKey: string
  private readonly baseUrl: string
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly retryBaseMs: number
  private readonly maxRetryDelayMs: number
  private readonly fetchImpl: typeof fetch
  private readonly logger?: (event: UmovLogEvent) => void
  private readonly limiter: RateLimiter

  constructor(opts: TransportV2Options) {
    this.appId = String(opts.appId)
    this.appKey = opts.appKey
    this.baseUrl = (opts.baseUrl ?? 'https://api.umov.me/v2').replace(/\/$/, '')
    this.maxRetries = opts.maxRetries ?? 3
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.retryBaseMs = opts.retryBaseMs ?? 500
    this.maxRetryDelayMs = opts.maxRetryDelayMs ?? 60_000
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.logger = opts.logger
    this.limiter = new RateLimiter(opts.requestsPerSecond ?? 4)
  }

  /** AppKey nunca aparece em logs/erros (não vai na URL, mas a redação é defensiva). */
  redact(text: string): string {
    return this.appKey ? text.split(this.appKey).join('***') : text
  }

  async request(method: V2Method, path: string, body?: unknown): Promise<V2Result> {
    const url = `${this.baseUrl}/${path.replace(/^\//, '')}`
    const headers: Record<string, string> = { AppId: this.appId, AppKey: this.appKey, Accept: 'application/json' }
    const init: RequestInit = { method, headers }
    if (body !== undefined) {
      if (typeof FormData !== 'undefined' && body instanceof FormData) {
        init.body = body // multipart: o fetch define o boundary no Content-Type
      } else {
        headers['Content-Type'] = 'application/json'
        init.body = JSON.stringify(body)
      }
    }

    const idempotent = method !== 'POST'

    for (let attempt = 0; ; attempt++) {
      await this.limiter.acquire()
      this.logger?.({ type: 'request', method, url, attempt })

      let res: Response
      let text: string
      try {
        res = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
        text = await res.text()
      } catch (cause) {
        if (idempotent && attempt < this.maxRetries) {
          this.logger?.({ type: 'retry', method, url, attempt })
          await sleep(this.retryBaseMs * 2 ** attempt)
          continue
        }
        throw new UmovApiError(0, { method, url, responseBody: this.redact(String(cause)) }, 'falha de rede/timeout')
      }

      if (res.ok) return parseV2Envelope(res.status, text)

      const retryable = res.status === 429 || (res.status === 504 && idempotent)
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const wait =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, this.maxRetryDelayMs)
            : this.retryBaseMs * 2 ** attempt
        this.logger?.({ type: 'retry', method, url, status: res.status, attempt })
        await sleep(wait)
        continue
      }

      this.logger?.({ type: 'error', method, url, status: res.status, attempt })
      const envelope = parseV2Envelope(res.status, text)
      throw errorFromStatus(res.status, {
        method,
        url,
        responseBody: this.redact(text),
        messages: envelope.messages,
      })
    }
  }

  post(path: string, body?: unknown): Promise<V2Result> {
    return this.request('POST', path, body)
  }

  put(path: string, body?: unknown): Promise<V2Result> {
    return this.request('PUT', path, body)
  }

  patch(path: string, body?: unknown): Promise<V2Result> {
    return this.request('PATCH', path, body)
  }

  delete(path: string, body?: unknown): Promise<V2Result> {
    return this.request('DELETE', path, body)
  }
}
