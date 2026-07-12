export interface UmovErrorContext {
  method: string
  /** URL com o apiKey já substituído por *** (redigida pelo Transport). */
  url: string
  responseBody: string
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
  /** Mensagem de erro reportada pela própria API (elemento <errors>), quando presente. */
  readonly apiErrors?: string

  constructor(status: number, ctx: UmovErrorContext, detail?: string) {
    const apiErrors = extractApiErrors(ctx.responseBody)
    super(
      `uMov.me API ${status}${detail ? ` (${detail})` : ''}: ${ctx.method} ${ctx.url}${apiErrors ? ` — ${apiErrors}` : ''}`,
    )
    this.name = new.target.name
    this.status = status
    this.method = ctx.method
    this.url = ctx.url
    this.responseBody = ctx.responseBody
    this.apiErrors = apiErrors
  }
}

export class UmovValidationError extends UmovApiError {}
export class UmovAuthError extends UmovApiError {}
export class UmovNotFoundError extends UmovApiError {}
export class UmovRateLimitError extends UmovApiError {}
export class UmovApiNotEnabledError extends UmovApiError {}
export class UmovTimeoutError extends UmovApiError {}

export function errorFromStatus(status: number, ctx: UmovErrorContext): UmovApiError {
  switch (status) {
    case 400: return new UmovValidationError(status, ctx, 'requisição malformada')
    case 401: return new UmovAuthError(status, ctx, 'apiKey inválida')
    case 404: return new UmovNotFoundError(status, ctx, 'não encontrado')
    case 429: return new UmovRateLimitError(status, ctx, 'rate limit excedido')
    case 501: return new UmovApiNotEnabledError(status, ctx, 'entidade não habilitada para API neste ambiente')
    case 504: return new UmovTimeoutError(status, ctx, 'timeout no servidor')
    default: return new UmovApiError(status, ctx)
  }
}
