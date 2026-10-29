import { describe, expect, it } from 'vitest'
import { createItineraryResources } from '../../../src/v2/resources/itineraries'
import { mockTransport } from '../helpers'

describe('v2 itineraries', () => {
  const { transport, last } = mockTransport()
  const r = createItineraryResources(transport)

  it('create normaliza datas', async () => {
    await r.itineraries.create({
      description: 'Rota 2',
      alternativeIdentifier: 'rota2',
      initialDate: new Date(2026, 10, 5),
      finalDate: '2026-12-31',
      agents: [{ agent: { alternativeIdentifier: 'ana' } }],
      locais: [{ treatmentOrder: 1, initialHour: '08:00', finalHour: '10:00' }],
    })
    expect(last()).toEqual({
      method: 'POST',
      path: 'itinerary',
      body: {
        description: 'Rota 2',
        alternativeIdentifier: 'rota2',
        initialDate: '2026-11-05',
        finalDate: '2026-12-31',
        agents: [{ agent: { alternativeIdentifier: 'ana' } }],
        locais: [{ treatmentOrder: 1, initialHour: '08:00', finalHour: '10:00' }],
      },
    })
  })

  it('put/patch/remove', async () => {
    await r.itineraries.put({ altId: 'rota2' }, { description: 'Rota 2b', initialDate: new Date(2026, 0, 1) })
    expect(last()).toEqual({ method: 'PUT', path: 'itinerary/alt-id/rota2', body: { description: 'Rota 2b', initialDate: '2026-01-01' } })
    await r.itineraries.patch(7, { active: '0' })
    expect(last()).toEqual({ method: 'PATCH', path: 'itinerary/7', body: { active: '0' } })
    await r.itineraries.remove('rota2')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'itinerary/alt-id/rota2' })
  })

  it('duplicate', async () => {
    await r.itineraries.duplicate({ description: 'Cópia', sourceAlternativeIdentifier: 'rota2' })
    expect(last()).toEqual({ method: 'POST', path: 'itinerary/duplicate', body: { description: 'Cópia', sourceAlternativeIdentifier: 'rota2' } })
  })

  it('activities/agents/teams add/remove', async () => {
    await r.itineraries.activities.add({ altId: 'rota2' }, { altId: 'VIS' })
    expect(last()).toMatchObject({ method: 'POST', path: 'itinerary/alt-id/rota2/activity/alt-id/VIS' })
    await r.itineraries.activities.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'itinerary/1/activity/2' })
    await r.itineraries.agents.add(1, 3)
    expect(last()).toMatchObject({ method: 'POST', path: 'itinerary/1/agent/3' })
    await r.itineraries.agents.remove('rota2', 'ana')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'itinerary/alt-id/rota2/agent/alt-id/ana' })
    await r.itineraries.teams.add(1, 4)
    expect(last()).toMatchObject({ method: 'POST', path: 'itinerary/1/team/4' })
    await r.itineraries.teams.remove(1, 4)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'itinerary/1/team/4' })
  })

  it('serviceLocals add/remove/patch', async () => {
    await r.itineraries.serviceLocals.add(1, 9)
    // sem corpo informado o transporte envia {} (a API rejeita corpo vazio em POST)
    expect(last()).toEqual({ method: 'POST', path: 'itinerary/1/service-local/9', body: {} })
    await r.itineraries.serviceLocals.add('rota2', 'LOJA-1', { treatmentOrder: 2, initialHour: '08:01', finalHour: '10:00' })
    expect(last()).toEqual({
      method: 'POST',
      path: 'itinerary/alt-id/rota2/service-local/alt-id/LOJA-1',
      body: { treatmentOrder: 2, initialHour: '08:01', finalHour: '10:00' },
    })
    await r.itineraries.serviceLocals.patch(1, 9, { treatmentOrder: 3 })
    expect(last()).toEqual({ method: 'PATCH', path: 'itinerary/1/service-local/9', body: { treatmentOrder: 3 } })
    await r.itineraries.serviceLocals.remove(1, 9)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'itinerary/1/service-local/9' })
  })

  it('vínculo rejeita refs mistos', async () => {
    await expect(r.itineraries.agents.add(1, 'ana')).rejects.toThrow(/mesmo tipo/)
  })
})
