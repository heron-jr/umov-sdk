import { describe, expect, it } from 'vitest'
import { UmovConfigError } from '../../../src/core/errors'
import { createLocalResources } from '../../../src/v2/resources/locals'
import { mockTransport } from '../helpers'

describe('v2 locals', () => {
  const { transport, last } = mockTransport()
  const r = createLocalResources(transport)

  it('locals create/put/patch', async () => {
    await r.locals.create({ description: 'Loja 1', alternativeIdentifier: 'L1', address: { city: 'POA' } })
    expect(last()).toEqual({ method: 'POST', path: 'locals', body: { description: 'Loja 1', alternativeIdentifier: 'L1', address: { city: 'POA' } } })
    await r.locals.put({ altId: 'L1' }, { description: 'Loja 1B' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'locals/alt-id/L1' })
    await r.locals.patch(7, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'locals/7', body: { active: false } })
  })

  it('locals.activities add/remove/patch', async () => {
    await r.locals.activities.add({ altId: 'L1' }, { altId: 'VIS' })
    expect(last()).toMatchObject({ method: 'POST', path: 'locals/alt-id/L1/activity/alt-id/VIS' })
    await r.locals.activities.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'locals/1/activity/2' })
    await r.locals.activities.patch(1, 2, { alternativeIdentifier: 'VIS' })
    expect(last()).toEqual({ method: 'PATCH', path: 'locals/1/activity/2', body: { alternativeIdentifier: 'VIS' } })
  })

  it('locals.items add/remove/patchCustomField', async () => {
    await r.locals.items.add({ altId: 'L1' }, { altId: 'IT-1' })
    expect(last()).toMatchObject({ method: 'POST', path: 'locals/alt-id/L1/item/alt-id/IT-1' })
    await r.locals.items.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'locals/1/item/2' })
    await r.locals.items.patchCustomField(1, 2, 3, { customField: { value: 'x' } })
    expect(last()).toEqual({ method: 'PATCH', path: 'locals/1/item/2/custom-field/3', body: { customField: { value: 'x' } } })
    await r.locals.items.patchCustomField('L1', 'IT-1', 'CF', { customField: { alternativeIdentifier: 'CF', value: 'x' } })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'locals/alt-id/L1/item/alt-id/IT-1/custom-field/alt-id/CF' })
    await expect(r.locals.items.patchCustomField(1, 2, 'CF', { customField: { value: 'x' } })).rejects.toBeInstanceOf(UmovConfigError)
  })

  it('locals.tags add/remove/patch', async () => {
    await r.locals.tags.add({ altId: 'L1' }, { altId: 'TAG-1' })
    expect(last()).toMatchObject({ method: 'POST', path: 'locals/alt-id/L1/tag/alt-id/TAG-1' })
    await r.locals.tags.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'locals/1/tag/2' })
    await r.locals.tags.patch(1, 2, { local: { id: 1 }, tag: { id: 2 } })
    expect(last()).toEqual({ method: 'PATCH', path: 'locals/1/tag/2', body: { local: { id: 1 }, tag: { id: 2 } } })
  })

  it('localTypes create/patch/remove', async () => {
    await r.localTypes.create({ description: 'Filial', localFilter: 'ORIGIN' })
    expect(last()).toEqual({ method: 'POST', path: 'localTypes', body: { description: 'Filial', localFilter: 'ORIGIN' } })
    await r.localTypes.patch('FIL', { active: 'FALSE' })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'localTypes/alt-id/FIL' })
    await r.localTypes.remove(3)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'localTypes/3' })
  })

  it('localGroups e localClassifications remove (só id)', async () => {
    await r.localGroups.remove(4)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'localGroups/4' })
    await r.localClassifications.remove({ id: 5 })
    expect(last()).toMatchObject({ method: 'DELETE', path: 'localClassifications/5' })
  })

  it('tags create/patch', async () => {
    await r.tags.create({ entity: 'SERVICE_LOCAL', text: 'Urgente', alternativeIdentifier: 'TAG-1' })
    expect(last()).toEqual({ method: 'POST', path: 'tags', body: { entity: 'SERVICE_LOCAL', text: 'Urgente', alternativeIdentifier: 'TAG-1' } })
    await r.tags.patch('TAG-1', { active: 'FALSE' })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'tags/alt-id/TAG-1' })
    await r.tags.patch(6, { text: 'Normal' })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'tags/6' })
  })
})
