import { describe, expect, it } from 'vitest'
import { createItemResources } from '../../../src/v2/resources/items'
import { mockTransport } from '../helpers'

describe('v2 items', () => {
  const { transport, last } = mockTransport()
  const r = createItemResources(transport)

  it('items create/upsert/put/patch', async () => {
    const body = { description: 'Parafuso', alternativeIdentifier: 'PAR-1', subGroup: { alternativeIdentifier: 'FIX' } }
    await r.items.create(body)
    expect(last()).toEqual({ method: 'POST', path: 'item', body })
    await r.items.upsert(body)
    expect(last()).toEqual({ method: 'PUT', path: 'item', body })
    await r.items.put({ altId: 'PAR-1' }, { description: 'Parafuso 2' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'item/alt-id/PAR-1' })
    await r.items.patch(5, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'item/5', body: { active: false } })
  })

  it('subGroups create/put/patch', async () => {
    await r.subGroups.create({ description: 'Fixação', alternativeIdentifier: 'FIX', group: { id: 1 } })
    expect(last()).toMatchObject({ method: 'POST', path: 'subgroup' })
    await r.subGroups.put('FIX', { description: 'Fixação' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'subgroup/alt-id/FIX' })
    await r.subGroups.patch(3, { orderView: 2 })
    expect(last()).toEqual({ method: 'PATCH', path: 'subgroup/3', body: { orderView: 2 } })
  })

  it('additionalInfoItems create/put (só id)', async () => {
    const body = { active: true, featuredInfo: 'Em promoção', itemId: 1, sectionId: 2, serviceLocalId: 3 }
    await r.additionalInfoItems.create(body)
    expect(last()).toEqual({ method: 'POST', path: 'aditional-info-items', body })
    await r.additionalInfoItems.put({ id: 9 }, body)
    expect(last()).toEqual({ method: 'PUT', path: 'aditional-info-items/9', body })
    await r.additionalInfoItems.put(9, body)
    expect(last()).toMatchObject({ method: 'PUT', path: 'aditional-info-items/9' })
  })
})
