import { describe, expect, it } from 'vitest'
import { createCustomResources } from '../../../src/v2/resources/custom'
import { mockTransport } from '../helpers'

describe('v2 custom', () => {
  const { transport, last } = mockTransport()
  const r = createCustomResources(transport)

  it('customEntities create/put/patch', async () => {
    await r.customEntities.create({ description: 'Produtos', alternativeIdentifier: 'PROD' })
    expect(last()).toEqual({ method: 'POST', path: 'custom-entity', body: { description: 'Produtos', alternativeIdentifier: 'PROD' } })
    await r.customEntities.put({ altId: 'PROD' }, { description: 'Produtos B' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'custom-entity/alt-id/PROD' })
    await r.customEntities.patch(7, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'custom-entity/7', body: { active: false } })
  })

  it('customEntities.deleteAll (DELETE com body)', async () => {
    await r.customEntities.deleteAll({ customEntityAltIds: ['PROD', 'CLI'] })
    expect(last()).toEqual({ method: 'DELETE', path: 'internal/custom-entities/delete-all', body: { customEntityAltIds: ['PROD', 'CLI'] } })
  })

  it('customEntityEntries create/upsert/put/patch/remove', async () => {
    await r.customEntityEntries.create({ customEntityAltId: 'PROD', alternativeIdentifier: 'P1', description: 'Parafuso' })
    expect(last()).toEqual({ method: 'POST', path: 'custom-entity-entry', body: { customEntityAltId: 'PROD', alternativeIdentifier: 'P1', description: 'Parafuso' } })
    await r.customEntityEntries.upsert({ customEntityAltId: 'PROD', alternativeIdentifier: 'P1', description: 'Parafuso' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'custom-entity-entry' })
    await r.customEntityEntries.put('P1', { description: 'Parafuso M4' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'custom-entity-entry/alt-id/P1' })
    await r.customEntityEntries.patch(3, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'custom-entity-entry/3', body: { active: false } })
    await r.customEntityEntries.remove({ altId: 'P1' })
    expect(last()).toMatchObject({ method: 'DELETE', path: 'custom-entity-entry/alt-id/P1' })
  })

  it('customEntityEntries.removeMixItem', async () => {
    await r.customEntityEntries.removeMixItem(10, 20)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'custom-entity-entry/mixItem/10/20' })
  })

  it('customFields create/patch por entidade', async () => {
    await r.customFields.create('TASK', { description: 'Placa', size: 10, typeField: 'ALPHANUMERIC', alternativeIdentifier: 'placa' })
    expect(last()).toEqual({ method: 'POST', path: 'customField/entity/TASK', body: { description: 'Placa', size: 10, typeField: 'ALPHANUMERIC', alternativeIdentifier: 'placa' } })
    await r.customFields.patch('SERVICE_LOCAL', 'placa', { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'customField/entity/SERVICE_LOCAL/alt-id/placa', body: { active: false } })
  })
})
