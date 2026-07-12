import { describe, expect, it } from 'vitest'
import {
  UmovApiError,
  UmovAuthError,
  UmovValidationError,
  UmovNotFoundError,
  UmovRateLimitError,
  UmovApiNotEnabledError,
  UmovTimeoutError,
  errorFromStatus,
} from '../../src/core/errors'

const ctx = { method: 'GET', url: 'https://api.umov.me/CenterWeb/api/***/agent.xml', responseBody: '<error/>' }

describe('errorFromStatus', () => {
  it.each([
    [400, UmovValidationError],
    [401, UmovAuthError],
    [404, UmovNotFoundError],
    [429, UmovRateLimitError],
    [501, UmovApiNotEnabledError],
    [504, UmovTimeoutError],
    [500, UmovApiError],
  ])('mapeia %i para a subclasse correta', (status, cls) => {
    const err = errorFromStatus(status, ctx)
    expect(err).toBeInstanceOf(cls)
    expect(err).toBeInstanceOf(UmovApiError)
    expect(err.status).toBe(status)
    expect(err.method).toBe('GET')
    expect(err.responseBody).toBe('<error/>')
    expect(err.message).toContain(String(status))
  })

  it('preserva a URL (já redigida pelo transport) na mensagem', () => {
    const err = errorFromStatus(404, ctx)
    expect(err.url).toContain('***')
    expect(err.url).not.toMatch(/[0-9a-f]{16,}/)
  })

  it('extrai <errors> do envelope de erro real da API para a mensagem', () => {
    const body = `<result><statusCode>400</statusCode><errors>alternativeIdentifier: error.form.alternativeIdentifierAlreadyInUse;</errors><resourceName>agentType</resourceName></result>`
    const err = errorFromStatus(400, { ...ctx, responseBody: body })
    expect(err.apiErrors).toBe('alternativeIdentifier: error.form.alternativeIdentifierAlreadyInUse;')
    expect(err.message).toContain('alternativeIdentifierAlreadyInUse')
  })
})
