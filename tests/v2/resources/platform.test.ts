import { describe, expect, it } from 'vitest'
import { createPlatformResources } from '../../../src/v2/resources/platform'
import { mockTransport } from '../helpers'

describe('v2 platform', () => {
  const { transport, last } = mockTransport()
  const r = createPlatformResources(transport)

  it('media.upload envia FormData (file, description, type)', async () => {
    const file = new Blob(['conteúdo'], { type: 'image/png' })
    await r.media.upload({ file, filename: 'foto.png', description: 'Foto da fachada', type: 'IMAGE' })
    const call = last()
    expect(call.method).toBe('POST')
    expect(call.path).toBe('media')
    expect(call.body).toBeInstanceOf(FormData)
    const fd = call.body as FormData
    expect(fd.get('description')).toBe('Foto da fachada')
    expect(fd.get('type')).toBe('IMAGE')
    expect((fd.get('file') as File).name).toBe('foto.png')
  })

  it('media.upload omite campos ausentes', async () => {
    await r.media.upload({ file: new Blob(['x']) })
    const fd = last().body as FormData
    expect(fd.has('file')).toBe(true)
    expect(fd.has('description')).toBe(false)
    expect(fd.has('type')).toBe(false)
  })

  it('media.tags', async () => {
    await r.media.tags({ hpiCodigo: 10, tags: { cor: 'azul' } })
    expect(last()).toEqual({ method: 'POST', path: 'media/tags', body: { hpiCodigo: 10, tags: { cor: 'azul' } } })
  })

  it('systemParameters.patch', async () => {
    await r.systemParameters.patch({ automaticSyncTime: 15, canCreateTaskOnMobile: 'TRUE', idiom: { id: 1 } })
    expect(last()).toEqual({
      method: 'PATCH',
      path: 'systemParameters',
      body: { automaticSyncTime: 15, canCreateTaskOnMobile: 'TRUE', idiom: { id: 1 } },
    })
  })

  it('appearances.patch', async () => {
    await r.appearances.patch({ primaryColor: '#112233', hideUmovMe: 'TRUE', loginPositionType: 'CENTER' })
    expect(last()).toEqual({
      method: 'PATCH',
      path: 'appearances',
      body: { primaryColor: '#112233', hideUmovMe: 'TRUE', loginPositionType: 'CENTER' },
    })
  })

  it('featureToggles create/patch', async () => {
    const dto = { id: 5, oldId: 5, tag: 'NEW_UI', description: 'Nova UI', sendToMobile: 'TRUE' as const, featureToggleModules: ['CENTER' as const] }
    await r.featureToggles.create(dto)
    expect(last()).toEqual({ method: 'POST', path: 'feature-toggle', body: dto })
    await r.featureToggles.patch({ id: 5 }, { active: 'FALSE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'feature-toggle/5', body: { active: 'FALSE' } })
  })

  it('featureToggles client/agent/global/partner add/remove', async () => {
    await r.featureToggles.client.add(5, 100)
    expect(last()).toMatchObject({ method: 'POST', path: 'feature-toggle/5/client/100' })
    await r.featureToggles.client.remove(5, 100)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'feature-toggle/5/client/100' })
    await r.featureToggles.agent.add(5, 100, 7)
    expect(last()).toMatchObject({ method: 'POST', path: 'feature-toggle/5/client/100/agent/7' })
    await r.featureToggles.agent.remove(5, 100, 7)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'feature-toggle/5/client/100/agent/7' })
    await r.featureToggles.global.add(5)
    expect(last()).toMatchObject({ method: 'POST', path: 'feature-toggle/5/global' })
    await r.featureToggles.global.remove(5)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'feature-toggle/5/global' })
    await r.featureToggles.partner.add(5, 3)
    expect(last()).toMatchObject({ method: 'POST', path: 'feature-toggle/5/partner/3' })
    await r.featureToggles.partner.remove(5, 3)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'feature-toggle/5/partner/3' })
  })
})
