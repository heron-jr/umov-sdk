import { errorFromStatus, UmovApiError, UmovConfigError } from './errors'
import { RateLimiter } from './rate-limit'

export interface UmovLogEvent {
  type: 'request' | 'retry' | 'error' | 'warning'
  method: string
  url: string // sempre redigida
  status?: number
  attempt?: number
  /** Apenas em 'warning': o que está errado na chamada. */
  message?: string
}

/**
 * Assinatura de valor já percent-encodado: '%' seguido de dois dígitos hex.
 *
 * Existe por causa de um modo de falha silencioso: quem migra de código que montava a query
 * string à mão passa valores já encodados ('2026-10-14%2000:00:00'). Como buildUrl encoda,
 * o '%' vira '%25' e a API recebe '%2520' — devolvendo lista VAZIA, com HTTP 200 e sem erro.
 * O consumidor conclui que não há registros.
 *
 * Um '%' solto ('50% off') não casa, então não gera falso positivo.
 */
const PRE_ENCODED = /%[0-9A-Fa-f]{2}/

function preEncodedKeys(query?: Record<string, string>): string[] {
  if (!query) return []
  return Object.entries(query)
    .filter(([, value]) => PRE_ENCODED.test(value))
    .map(([key]) => key)
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
  /**
   * Tamanho de página das listagens, conforme configurado no SEU ambiente uMov.me (25, 50 ou 100).
   * Sem isso o SDK detecta automaticamente, ao custo de no máximo uma requisição extra por iteração.
   */
  pageSize?: 25 | 50 | 100
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
  /** Tamanho de página configurado (ver TransportOptions.pageSize); undefined = detecção automática. */
  readonly pageSize?: number
  /** Chaves já avisadas, para não repetir o aviso de pré-encode a cada requisição. */
  private readonly warnedPreEncoded = new Set<string>()

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
    this.pageSize = opts.pageSize
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
    return this.apiKey ? url.split(this.apiKey).join('***') : url
  }

  /**
   * Avisa quando um valor de query chega já percent-encodado — o SDK encoda, então o valor
   * dobra e a API devolve lista vazia sem erro (ver PRE_ENCODED).
   *
   * Cai em console.warn quando não há logger: o modo de falha é silencioso, e um aviso que
   * depende de configuração opcional não resolveria o problema. Avisa uma vez por chave, por
   * instância, para não poluir log de worker que roda em laço.
   */
  private warnPreEncoded(method: string, redacted: string, query?: Record<string, string>): void {
    const keys = preEncodedKeys(query).filter((key) => !this.warnedPreEncoded.has(key))
    if (keys.length === 0) return

    for (const key of keys) this.warnedPreEncoded.add(key)

    const message =
      `valor de query já percent-encodado em: ${keys.join(', ')}. ` +
      `Passe o valor cru — o SDK encoda. Use '2026-10-14 00:00:00', não '2026-10-14%2000:00:00'. ` +
      `Encodado duas vezes, a API responde 200 com lista vazia.`

    if (this.logger) this.logger({ type: 'warning', method, url: redacted, message })
    else console.warn(`[umov-sdk] ${message}`)
  }

  private async request(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    query?: Record<string, string>,
    body?: string,
  ): Promise<string> {
    // Cliente construído só com credenciais v2: os recursos v1 existem, mas não têm como autenticar.
    if (!this.apiKey) {
      throw new UmovConfigError(
        'apiKey (API v1) não configurada — passe `apiKey` em UmovClient para usar os recursos XML/v1',
      )
    }
    const url = this.buildUrl(path, query)
    const redacted = this.redact(url)
    this.warnPreEncoded(method, redacted, query)
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
