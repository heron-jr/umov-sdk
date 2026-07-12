/**
 * Bateria de integração contra o ambiente real da uMov.me.
 * Roda apenas via `npm run test:integration` (carrega UMOV_API_KEY do env ou do .env).
 * Escritas são restritas ao agentType 'sdk-teste-r2', claramente marcado como teste.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UmovClient, UmovNotFoundError, UmovAuthError } from '../../src'

function loadKey(): string | undefined {
  if (process.env.UMOV_API_KEY) return process.env.UMOV_API_KEY
  const envFile = join(__dirname, '..', '..', '.env')
  if (!existsSync(envFile)) return undefined
  return /UMOV_API_KEY=(\S+)/.exec(readFileSync(envFile, 'utf8'))?.[1]
}

const apiKey = loadKey()
const TIMEOUT = 60_000

describe.skipIf(!apiKey)('integração uMov.me (ambiente laivon)', () => {
  const umov = new UmovClient({ apiKey: apiKey ?? '' })

  it('lista agents e hidrata o primeiro', { timeout: TIMEOUT }, async () => {
    const page = await umov.agents.list()
    expect(page.size).toBeGreaterThan(0)
    const first = page.entries[0]!
    const agent = await umov.agents.get(first.id)
    expect(agent.id).toBe(first.id)
    expect(typeof agent.name).toBe('string')
  })

  it('auto-paginação para corretamente em entidade com >100 registros', { timeout: TIMEOUT * 3 }, async () => {
    // serviceLocal tem >200 registros no ambiente laivon; consome só o suficiente para cruzar a página 2
    const ids: number[] = []
    for await (const stub of umov.serviceLocals.iterate()) {
      ids.push(stub.id)
      if (ids.length >= 120) break
    }
    expect(ids.length).toBe(120)
    expect(new Set(ids).size).toBe(120) // sem duplicatas entre páginas
  })

  it('schedule detail traz agent/serviceLocal aninhados', { timeout: TIMEOUT }, async () => {
    const page = await umov.schedules.list()
    const detail = await umov.schedules.get(page.entries[0]!.id)
    expect(detail.id).toBe(page.entries[0]!.id)
    expect(detail.agent).toBeDefined()
  })

  it('activityHistory com filtro de data antigo + hierarchical', { timeout: TIMEOUT }, async () => {
    const page = await umov.activityHistories.list({ initialStartTimeOnSystem: '2020-01-01 00:00:00' })
    expect(page.size).toBeGreaterThan(0)
    const tree = await umov.activityHistories.hierarchical(page.entries[0]!.id)
    expect(tree.id).toBe(page.entries[0]!.id)
    expect(tree.activity).toBeDefined()
  })

  it('customFields.of(serviceLocal).list retorna stubs', { timeout: TIMEOUT }, async () => {
    const locals = await umov.serviceLocals.list()
    const fields = await umov.customFields.of('serviceLocal', locals.entries[0]!.id).list()
    expect(fields.size).toBeGreaterThanOrEqual(0)
  })

  it('404 vira UmovNotFoundError', { timeout: TIMEOUT }, async () => {
    await expect(umov.agents.get(999_999_999)).rejects.toBeInstanceOf(UmovNotFoundError)
  })

  it('token inválido vira UmovAuthError', { timeout: TIMEOUT }, async () => {
    const bad = new UmovClient({ apiKey: 'tokeninvalido123' })
    await expect(bad.agents.list()).rejects.toBeInstanceOf(UmovAuthError)
  })
})
