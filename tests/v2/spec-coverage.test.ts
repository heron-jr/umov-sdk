import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { UmovV2Client } from '../../src/v2/client'

/**
 * Garante que TODA operação da spec OpenAPI (docs/api-v2-openapi.json) é alcançável por algum método
 * do UmovV2Client. Percorre o cliente, chama cada função com argumentos fictícios (ids e altIds),
 * registra método+path e compara com a spec após normalizar os segmentos variáveis para `{}`.
 */
const spec = JSON.parse(readFileSync(join(__dirname, '..', '..', 'docs', 'api-v2-openapi.json'), 'utf8')) as {
  paths: Record<string, Record<string, unknown>>
}

// A spec publica o mesmo contrato sob dois prefixos; o SDK usa só o plural / sem `/api`.
const DUPLICATE_PREFIXES = ['/local/', '/local', '/task/', '/task', '/api/']
const isDuplicate = (p: string) =>
  DUPLICATE_PREFIXES.some((d) => (d.endsWith('/') ? p.startsWith(d) : p === d))

const DUMMIES = new Set(['1', '2', '3', 'a', 'b', 'c'])
const normalize = (p: string) =>
  p
    .replace(/^\//, '')
    .split('/')
    .map((seg) => (/^\{.*\}$/.test(seg) || DUMMIES.has(seg) ? '{}' : seg))
    .join('/')

const expected = new Set<string>()
for (const [p, ops] of Object.entries(spec.paths)) {
  if (isDuplicate(p)) continue
  for (const m of Object.keys(ops)) expected.add(`${m.toUpperCase()} ${normalize(p)}`)
}

async function collectReachable(): Promise<Set<string>> {
  const reached = new Set<string>()
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    // argumentos fictícios que não casam com a assinatura geram segmentos inválidos — não contam
    if (!/undefined|\[object|%5Bobject/.test(String(url)))
      reached.add(`${init?.method} ${normalize(String(url).replace('https://api.umov.me/v2/', ''))}`)
    return new Response('{"code":200}', { status: 200 })
  })
  const v2 = new UmovV2Client({ appId: 1, appKey: 'k', requestsPerSecond: 1e6, fetch: fetchMock as unknown as typeof fetch })

  const argSets: unknown[][] = [
    [1, 2, 3, {}],
    ['a', 'b', 'c', {}],
    [{ file: new Blob(['x']) }],
    [[{ id: 1 }]],
  ]
  const visit = async (node: unknown, trail: string): Promise<void> => {
    if (typeof node === 'function') {
      for (const args of argSets) {
        try {
          await (node as (...a: unknown[]) => Promise<unknown>)(...args)
        } catch {
          // refs mistas / args inválidos para esta assinatura: ignorado
        }
      }
      return
    }
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) if (k !== 'transport') await visit(v, `${trail}.${k}`)
    }
  }
  await visit(v2, 'v2')
  return reached
}

describe('cobertura da spec v2', () => {
  it('toda operação da spec é alcançável pelo UmovV2Client', async () => {
    const reached = await collectReachable()
    const missing = [...expected].filter((op) => !reached.has(op)).sort()
    expect(missing, `operações da spec sem wrapper:\n${missing.join('\n')}`).toEqual([])
  })

  it('nenhum wrapper chama path fora da spec', async () => {
    const reached = await collectReachable()
    const extra = [...reached].filter((op) => !expected.has(op)).sort()
    expect(extra, `paths chamados que não existem na spec:\n${extra.join('\n')}`).toEqual([])
  })
})
