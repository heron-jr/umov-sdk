import { errorFromStatus } from './errors'
import { parseXml, serializeEntity } from './xml'

export interface TokenCredentials {
  login: string
  password: string
  /** Nome do ambiente uMov.me (ex.: 'laivon'). */
  domain: string
  baseUrl?: string
  fetch?: typeof fetch
}

/**
 * Recupera o token de API do ambiente via POST /token.xml (validado contra a API real:
 * corpo data= form-encoded, token retornado em <result><message>).
 * ATENÇÃO: regenerar o token no Center invalida o token recuperado aqui.
 */
export async function getToken(credentials: TokenCredentials): Promise<string> {
  const baseUrl = (credentials.baseUrl ?? 'https://api.umov.me/CenterWeb/api').replace(/\/$/, '')
  const fetchImpl = credentials.fetch ?? globalThis.fetch
  const url = `${baseUrl}/token.xml`
  const xml = serializeEntity('apiToken', {
    login: credentials.login,
    password: credentials.password,
    domain: credentials.domain,
  })

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(xml)}`,
  })
  const text = await res.text()
  if (!res.ok) {
    // Sem segredos aqui: a URL não tem token e o corpo de erro não ecoa credenciais
    throw errorFromStatus(res.status, { method: 'POST', url, responseBody: text })
  }
  const doc = parseXml(text) as { result?: { message?: string } }
  const token = doc.result?.message?.trim()
  if (!token) throw new Error('Resposta do /token.xml sem <message> com o token')
  return token
}
