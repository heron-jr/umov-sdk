import { describe, expect, it } from 'vitest'
import { createActivityResources } from '../../../src/v2/resources/activities'
import { mockTransport } from '../helpers'

describe('v2 activities', () => {
  const { transport, last } = mockTransport()
  const r = createActivityResources(transport)

  it('activities create/patch normalizam datas de vigência', async () => {
    await r.activities.create({ description: 'Visita', alternativeIdentifier: 'VIS', active: 'TRUE', initialEffectiveDate: new Date(2026, 10, 5) })
    expect(last()).toEqual({
      method: 'POST',
      path: 'activities',
      body: { description: 'Visita', alternativeIdentifier: 'VIS', active: 'TRUE', initialEffectiveDate: '2026-11-05' },
    })
    await r.activities.patch({ altId: 'VIS' }, { finalEffectiveDate: new Date(2026, 11, 31) })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/alt-id/VIS', body: { finalEffectiveDate: '2026-12-31' } })
    await r.activities.patch(7, { active: 'FALSE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/7', body: { active: 'FALSE' } })
  })

  it('activities remove só por altId', async () => {
    await r.activities.remove('VIS')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'activities/alt-id/VIS' })
  })

  it('activities copy/setDefault/unsetDefault', async () => {
    await r.activities.copy({ activityId: 7, newDescription: 'Visita (cópia)' })
    expect(last()).toEqual({ method: 'POST', path: 'activities/copy', body: { activityId: 7, newDescription: 'Visita (cópia)' } })
    await r.activities.setDefault({ alternativeIdentifier: 'VIS' })
    expect(last()).toEqual({ method: 'POST', path: 'activities/default', body: { alternativeIdentifier: 'VIS' } })
    await r.activities.unsetDefault({ activityId: 7 })
    expect(last()).toEqual({ method: 'DELETE', path: 'activities/default', body: { activityId: 7 } })
  })

  it('activities.ancestors replace/add/remove (só id)', async () => {
    await r.activities.ancestors.replace(7, [{ activityId: 1 }, { alternativeIdentifier: 'A2' }])
    expect(last()).toEqual({ method: 'PUT', path: 'activities/7/ancestors', body: [{ activityId: 1 }, { alternativeIdentifier: 'A2' }] })
    await r.activities.ancestors.add({ id: 7 }, { activityId: 3 })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/7/ancestors', body: { activityId: 3 } })
    await r.activities.ancestors.remove(7, 3)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'activities/7/ancestors/3' })
  })

  it('activities.impediments replace/add/remove (só id)', async () => {
    await r.activities.impediments.replace(7, [{ activityId: 1 }])
    expect(last()).toEqual({ method: 'PUT', path: 'activities/7/impediments', body: [{ activityId: 1 }] })
    await r.activities.impediments.add(7, { alternativeIdentifier: 'A9' })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/7/impediments', body: { alternativeIdentifier: 'A9' } })
    await r.activities.impediments.remove({ id: 7 }, 9)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'activities/7/impediments/9' })
  })

  it('activities.sections create (só id) e patch — alt-id SEM prefixo no segmento da seção', async () => {
    await r.activities.sections.create(7, { description: 'Checklist', mandatory: 'MANDATORY' })
    expect(last()).toEqual({ method: 'POST', path: 'activities/7/sections', body: { description: 'Checklist', mandatory: 'MANDATORY' } })
    await r.activities.sections.patch(7, 12, { active: 'FALSE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/7/sections/12', body: { active: 'FALSE' } })
    await r.activities.sections.patch('VIS', 'SEC-1', { active: 'FALSE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/alt-id/VIS/sections/SEC-1', body: { active: 'FALSE' } })
    await expect(r.activities.sections.patch('VIS', 12, { active: 'FALSE' })).rejects.toThrow(/mesmo tipo/)
  })

  it('activities.sections.fields create/patch — alt-id usa `field` singular SEM prefixo', async () => {
    await r.activities.sections.fields.create(7, 12, { label: 'Qtd', fieldType: 'NUMERIC' })
    expect(last()).toEqual({ method: 'POST', path: 'activities/7/sections/12/fields', body: { label: 'Qtd', fieldType: 'NUMERIC' } })
    await r.activities.sections.fields.create({ altId: 'VIS' }, { altId: 'SEC-1' }, { label: 'Qtd' })
    expect(last()).toMatchObject({ method: 'POST', path: 'activities/alt-id/VIS/sections/alt-id/SEC-1/fields' })
    await r.activities.sections.fields.patch(7, 12, 99, { mandatory: 'TRUE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/7/sections/12/fields/99', body: { mandatory: 'TRUE' } })
    await r.activities.sections.fields.patch('VIS', 'SEC-1', 'F-QTD', { mandatory: 'TRUE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'activities/alt-id/VIS/sections/alt-id/SEC-1/field/F-QTD', body: { mandatory: 'TRUE' } })
    await expect(r.activities.sections.fields.patch(7, 'SEC-1', 99, {})).rejects.toThrow(/mesmo tipo/)
  })

  it('activities.sections.items e subGroups add/remove', async () => {
    await r.activities.sections.items.add(7, 12, 500)
    expect(last()).toMatchObject({ method: 'POST', path: 'activities/7/sections/12/items/500' })
    await r.activities.sections.items.remove('VIS', 'SEC-1', 'ITEM-1')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'activities/alt-id/VIS/sections/alt-id/SEC-1/items/alt-id/ITEM-1' })
    await r.activities.sections.subGroups.add({ altId: 'VIS' }, { altId: 'SEC-1' }, { altId: 'SG-1' })
    expect(last()).toMatchObject({ method: 'POST', path: 'activities/alt-id/VIS/sections/alt-id/SEC-1/subgroups/alt-id/SG-1' })
    await r.activities.sections.subGroups.remove(7, 12, 33)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'activities/7/sections/12/subgroups/33' })
    await expect(r.activities.sections.items.add(7, 12, 'ITEM-1')).rejects.toThrow(/mesmo tipo/)
  })

  it('activityTypes create/patch/remove', async () => {
    await r.activityTypes.create({ description: 'Rota', active: 'TRUE' })
    expect(last()).toEqual({ method: 'POST', path: 'activityType', body: { description: 'Rota', active: 'TRUE' } })
    await r.activityTypes.patch('ROTA', { showMap: 'TRUE' })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'activityType/alt-id/ROTA' })
    await r.activityTypes.remove(4)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'activityType/4' })
  })

  it('formulas value/validation create/patch/remove', async () => {
    const formula = { activityId: 7, expression: [{ order: 1, type: 'FIELD', value: 'QTD' }] }
    await r.formulas.value.create('campo', formula)
    expect(last()).toEqual({ method: 'POST', path: 'formulas/valor/campo', body: formula })
    await r.formulas.value.patch('campo', 55, { active: false })
    expect(last()).toEqual({ method: 'PATCH', path: 'formulas/valor/campo/55', body: { active: false } })
    await r.formulas.value.remove('campo', { id: 55 })
    expect(last()).toMatchObject({ method: 'DELETE', path: 'formulas/valor/campo/55' })
    await r.formulas.validation.create('secao', formula)
    expect(last()).toEqual({ method: 'POST', path: 'formulas/validacao/secao', body: formula })
    await r.formulas.validation.patch('secao', { id: 56 }, { validationMessage: 'Inválido' })
    expect(last()).toEqual({ method: 'PATCH', path: 'formulas/validacao/secao/56', body: { validationMessage: 'Inválido' } })
    await r.formulas.validation.remove('secao', 56)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'formulas/validacao/secao/56' })
  })
})
