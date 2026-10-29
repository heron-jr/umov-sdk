import { describe, expect, it } from 'vitest'
import { UmovConfigError } from '../../../src/core/errors'
import { createTeamResources } from '../../../src/v2/resources/teams'
import { mockTransport } from '../helpers'

describe('v2 teams', () => {
  const { transport, last } = mockTransport()
  const r = createTeamResources(transport)

  it('teams create/patch', async () => {
    const body = { description: 'Equipe Sul', alternativeIdentifier: 'SUL', agentRelationship: [{ alternativeIdentifier: 'ana', teamResponsible: true }] }
    await r.teams.create(body)
    expect(last()).toEqual({ method: 'POST', path: 'team', body })
    await r.teams.patch({ altId: 'SUL' }, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'team/alt-id/SUL', body: { active: false } })
    await r.teams.patch(7, { description: 'Sul' })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'team/7' })
  })

  it('teams.agents por id — /team/{id}/agent/{id}', async () => {
    await r.teams.agents.add(1, 2)
    expect(last()).toMatchObject({ method: 'POST', path: 'team/1/agent/2' })
    await r.teams.agents.add(1, 2, { teamResponsible: true })
    expect(last()).toEqual({ method: 'POST', path: 'team/1/agent/2', body: { teamResponsible: true } })
    await r.teams.agents.put({ id: 1 }, { id: 2 }, { teamResponsible: false })
    expect(last()).toEqual({ method: 'PUT', path: 'team/1/agent/2', body: { teamResponsible: false } })
    await r.teams.agents.patch(1, 2, { teamResponsible: true })
    expect(last()).toEqual({ method: 'PATCH', path: 'team/1/agent/2', body: { teamResponsible: true } })
    await r.teams.agents.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'team/1/agent/2' })
  })

  it('teams.agents por altId — agente SEM alt-id/ em POST/PUT/PATCH e COM em DELETE', async () => {
    await r.teams.agents.add('SUL', 'ana')
    expect(last()).toMatchObject({ method: 'POST', path: 'team/alt-id/SUL/agent/ana' })
    await r.teams.agents.put({ altId: 'SUL' }, { altId: 'ana' }, { teamResponsible: true })
    expect(last()).toEqual({ method: 'PUT', path: 'team/alt-id/SUL/agent/ana', body: { teamResponsible: true } })
    await r.teams.agents.patch('SUL', 'ana', { teamResponsible: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'team/alt-id/SUL/agent/ana', body: { teamResponsible: false } })
    await r.teams.agents.remove('SUL', 'ana')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'team/alt-id/SUL/agent/alt-id/ana' })
  })

  it('teams.agents rejeita refs de tipos diferentes', async () => {
    await expect(r.teams.agents.add(1, 'ana')).rejects.toBeInstanceOf(UmovConfigError)
    await expect(r.teams.agents.remove('SUL', 2)).rejects.toBeInstanceOf(UmovConfigError)
  })

  it('teams.agents addByAltId e removeAll', async () => {
    await r.teams.agents.addByAltId('SUL', { alternativeIdentifier: 'ana', teamResponsible: true })
    expect(last()).toEqual({ method: 'POST', path: 'team/alt-id/SUL/agent', body: { alternativeIdentifier: 'ana', teamResponsible: true } })
    await r.teams.agents.removeAll('SUL')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'team/alt-id/SUL/agents' })
    await r.teams.agents.removeAll(7)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'team/7/agents' })
  })

  it('teams.locals add/remove', async () => {
    await r.teams.locals.add({ altId: 'SUL' }, { altId: 'LOJA-1' })
    expect(last()).toMatchObject({ method: 'POST', path: 'team/alt-id/SUL/local/alt-id/LOJA-1' })
    await r.teams.locals.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'team/1/local/2' })
  })
})
