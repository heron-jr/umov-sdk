import { describe, expect, it } from 'vitest'
import { createAgentResources } from '../../../src/v2/resources/agents'
import { mockTransport } from '../helpers'

describe('v2 agents', () => {
  const { transport, last } = mockTransport()
  const r = createAgentResources(transport)

  it('agents create/put/patch', async () => {
    await r.agents.create({ name: 'Ana', login: 'ana', agentType: { alternativeIdentifier: 'TEC' } })
    expect(last()).toEqual({ method: 'POST', path: 'agents', body: { name: 'Ana', login: 'ana', agentType: { alternativeIdentifier: 'TEC' } } })
    await r.agents.put({ altId: 'TEC-1' }, { name: 'Ana B' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'agents/alt-id/TEC-1' })
    await r.agents.patch(7, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'agents/7', body: { active: false } })
  })

  it('agents.activities add/remove', async () => {
    await r.agents.activities.add({ altId: 'TEC-1' }, { altId: 'VIS' })
    expect(last()).toMatchObject({ method: 'POST', path: 'agents/alt-id/TEC-1/activity/alt-id/VIS' })
    await r.agents.activities.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'agents/1/activity/2' })
  })

  it('agentTypes create/put/patch/remove', async () => {
    await r.agentTypes.create({ description: 'Técnico' })
    expect(last()).toMatchObject({ method: 'POST', path: 'agentType' })
    await r.agentTypes.put('TEC', { description: 'Téc' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'agentType/alt-id/TEC' })
    await r.agentTypes.patch(3, { active: true })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'agentType/3' })
    await r.agentTypes.remove(3)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'agentType/3' })
  })

  it('absences create/put/patch', async () => {
    await r.absences.create({ originAgent: { id: 1 }, action: '0', initialDateTime: '2026-11-01T00:00:00', finalDateTime: '2026-11-02T00:00:00' })
    expect(last()).toMatchObject({ method: 'POST', path: 'absence' })
    await r.absences.create({ originAgent: { id: 1 }, action: '0', initialDateTime: new Date(2030, 0, 1, 8, 0, 0), finalDateTime: '2030-01-01 18:00:00' })
    expect(last().body).toMatchObject({ initialDateTime: '2030-01-01 08:00:00', finalDateTime: '2030-01-01 18:00:00' })
    await r.absences.put(5, { active: false })
    expect(last()).toMatchObject({ method: 'PUT', path: 'absence/5' })
    await r.absences.patch({ altId: 'AUS-1' }, { description: 'férias' })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'absence/alt-id/AUS-1' })
  })

  it('workJourneys e workDays', async () => {
    await r.workJourneys.create({ description: 'Comercial', alternativeIdentifier: 'JC' })
    expect(last()).toMatchObject({ method: 'POST', path: 'workJourney' })
    await r.workJourneys.patch('JC', { active: false })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'workJourney/alt-id/JC' })
    await r.workJourneys.remove(4)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'workJourney/4' })
    await r.workJourneys.workDays.create('JC', { description: 'seg' })
    expect(last()).toMatchObject({ method: 'POST', path: 'workJourney/alt-id/JC/work-days' })
    await r.workJourneys.workDays.put('JC', { description: 'seg' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'workJourney/alt-id/JC/work-days' })
    await r.workJourneys.workDays.remove('JC', 'MONDAY')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'workJourney/alt-id/JC/work-days/MONDAY' })
  })

  it('workDayJourneys e passwordPolicies (só id)', async () => {
    await r.workDayJourneys.create({ description: 'x' })
    expect(last()).toMatchObject({ method: 'POST', path: 'workDayJourney' })
    await r.workDayJourneys.patch({ id: 9 }, { active: true })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'workDayJourney/9' })
    await r.workDayJourneys.remove(9)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'workDayJourney/9' })
    const policy = { minimumCharacters: 8, minimumLowerCharacters: 1, minimumUpperCharacters: 1, minimumNumericCharacters: 1, minimumSpecialCharacters: 0, passwordsToKeep: 3, preventPasswordReuse: true }
    await r.passwordPolicies.create(policy)
    expect(last()).toEqual({ method: 'POST', path: 'password-policies', body: policy })
    await r.passwordPolicies.put(2, policy)
    expect(last()).toMatchObject({ method: 'PUT', path: 'password-policies/2' })
    await r.passwordPolicies.remove(2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'password-policies/2' })
  })
})
