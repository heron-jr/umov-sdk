import type { V2Message } from '../v2/types'

export interface UmovErrorContext {
  method: string
  /** URL com o apiKey já substituído por *** (redigida pelo Transport). */
  url: string
  responseBody: string
  /** `operationMessages[]` do envelope da v2 (vazio/ausente na v1). */
  messages?: V2Message[]
}

/**
 * Extrai a mensagem do envelope de erro real da API: <result><statusCode/><errors>msg;</errors></result>.
 * O endpoint de token usa <error> no singular — ambos são aceitos.
 */
function extractApiErrors(body: string): string | undefined {
  const match = /<errors?>([^<]*)<\/errors?>/.exec(body)
  return match?.[1]?.trim() || undefined
}

export class UmovApiError extends Error {
  readonly status: number
  readonly method: string
  readonly url: string
  readonly responseBody: string
  /**
   * Mensagem de erro reportada pela própria API: elemento <errors> na v1; na v2, as chaves de
   * `operationMessages` unidas por `; `.
   */
  readonly apiErrors?: string
  /** `operationMessages[]` da v2 (`{ key, value }`). Sempre vazio na v1. */
  readonly messages: V2Message[]
  /** Só as chaves de `messages` — ex.: `['field_required:accessRole']`. */
  readonly keys: string[]

  constructor(status: number, ctx: UmovErrorContext, detail?: string) {
    const messages = ctx.messages ?? []
    const apiErrors = messages.length > 0 ? messages.map((m) => m.key).join('; ') : extractApiErrors(ctx.responseBody)
    super(
      `uMov.me API ${status}${detail ? ` (${detail})` : ''}: ${ctx.method} ${ctx.url}${apiErrors ? ` — ${apiErrors}` : ''}`,
    )
    this.name = new.target.name
    this.status = status
    this.method = ctx.method
    this.url = ctx.url
    this.responseBody = ctx.responseBody
    this.apiErrors = apiErrors
    this.messages = messages
    this.keys = messages.map((m) => m.key)
  }

  /**
   * A v2 devolve chaves estáveis com contexto após `:` (`resource_not_found:alternativeIdentifier=X`).
   * `hasKey('resource_not_found')` casa a chave exata e também qualquer uma com esse prefixo seguido de `:`.
   */
  hasKey(key: string): boolean {
    return this.keys.some((k) => k === key || k.startsWith(`${key}:`))
  }
}

export class UmovValidationError extends UmovApiError {}
export class UmovAuthError extends UmovApiError {}
export class UmovNotFoundError extends UmovApiError {}
export class UmovRateLimitError extends UmovApiError {}
export class UmovApiNotEnabledError extends UmovApiError {}
export class UmovTimeoutError extends UmovApiError {}

/** Erro de uso do SDK (credencial ausente, referência inválida) — nunca vem da API. */
export class UmovConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UmovConfigError'
  }
}

export function errorFromStatus(status: number, ctx: UmovErrorContext): UmovApiError {
  switch (status) {
    case 400: return new UmovValidationError(status, ctx, 'requisição malformada')
    case 401: return new UmovAuthError(status, ctx, ctx.messages ? 'AppId/AppKey inválidos' : 'apiKey inválida')
    case 404: return new UmovNotFoundError(status, ctx, 'não encontrado')
    case 429: return new UmovRateLimitError(status, ctx, 'rate limit excedido')
    case 501: return new UmovApiNotEnabledError(status, ctx, 'entidade não habilitada para API neste ambiente')
    case 504: return new UmovTimeoutError(status, ctx, 'timeout no servidor')
    default: return new UmovApiError(status, ctx)
  }
}
