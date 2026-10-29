/**
 * Bateria de integração da API 2.0 contra o ambiente real.
 * Roda apenas via `npm run test:integration` com UMOV_APP_ID e UMOV_APP_KEY no env ou no .env.
 * Escritas se restringem ao agentType 'sdk-teste-v2', claramente marcado como teste.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { UmovAuthError, UmovV2Client, UmovValidationError } from '../../src'

function loadEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name]
  const envFile = join(__dirname, '..', '..', '.env')
  if (!existsSync(envFile)) return undefined
  return new RegExp(`${name}=(\\S+)`).exec(readFileSync(envFile, 'utf8'))?.[1]
}

const appId = loadEnv('UMOV_APP_ID')
const appKey = loadEnv('UMOV_APP_KEY')
const TIMEOUT = 60_000

describe.skipIf(!appId || !appKey)('integração uMov.me API 2.0', () => {
  const v2 = new UmovV2Client({ appId: appId ?? '', appKey: appKey ?? '' })
  const altId = 'sdk-teste-v2'

  it('cria, altera e remove um agentType', { timeout: TIMEOUT }, async () => {
    const created = await v2.agentTypes.create({ description: 'SDK teste v2', alternativeIdentifier: altId, active: true })
    expect(created.code).toBe(200)
    expect(created.id).toBeTypeOf('number')

    const patched = await v2.agentTypes.patch({ altId }, { description: 'SDK teste v2 (alterado)' })
    expect(patched.code).toBe(200)

    const removed = await v2.agentTypes.remove({ altId })
    expect(removed.code).toBe(200)
  })

  it('payload inválido → UmovValidationError com chave estável', { timeout: TIMEOUT }, async () => {
    const err = await v2.agentTypes.create({ alternativeIdentifier: `${altId}-invalido` }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovValidationError)
    expect((err as UmovValidationError).keys.length).toBeGreaterThan(0)
    expect((err as UmovValidationError).hasKey('field_required')).toBe(true)
  })

  it('HTTP 200 com code 400 no envelope (tasks.prioritize em id inexistente) → UmovValidationError', { timeout: TIMEOUT }, async () => {
    const err = await v2.tasks.prioritize([{ id: 1, priority: 0 }]).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovValidationError)
    expect((err as UmovValidationError).hasKey('error.prioritizeTasks')).toBe(true)
  })

  it('AppKey inválida → UmovAuthError', { timeout: TIMEOUT }, async () => {
    const bad = new UmovV2Client({ appId: appId ?? '', appKey: 'chave-invalida' })
    await expect(bad.agentTypes.create({ description: 'x' })).rejects.toBeInstanceOf(UmovAuthError)
  })
})
