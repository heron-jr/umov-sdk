import { describe, expect, it, vi } from 'vitest'
import { TransportV2 } from '../../src/v2/transport'
import { refToV2Path, v2Action, v2Create, v2Delete, v2Link, v2Patch, v2Put } from '../../src/v2/resource'
import { customFieldsFromMap } from '../../src/v2/types'
import { UmovConfigError } from '../../src/core/errors'

function setup() {
  const fetchMock = vi.fn(async () => new Response('{"code":200,"id":"1"}', { status: 200 }))
  const transport = new TransportV2({ appId: 1, appKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch })
  const call = (i = 0) => {
    const [url, init] = fetchMock.mock.calls[i]! as unknown as [string, RequestInit]
    return { path: url.replace('https://api.umov.me/v2/', ''), method: init.method, body: init.body }
  }
  return { transport, call }
}

describe('refToV2Path', () => {
  it('id → "{id}", altId → "alt-id/{altId}" encodado', () => {
    expect(refToV2Path(42)).toBe('42')
    expect(refToV2Path({ id: 42 })).toBe('42')
    expect(refToV2Path('OS 1/2')).toBe('alt-id/OS%201%2F2')
    expect(refToV2Path({ altId: 'X' })).toBe('alt-id/X')
  })
})

describe('builders', () => {
  it('v2Create / v2Put / v2Patch / v2Delete / v2Action montam método e path', async () => {
    const { transport, call } = setup()
    await v2Create(transport, 'agents')({ name: 'A' })
    await v2Put(transport, 'agents')({ altId: 'T1' }, { name: 'B' })
    await v2Patch(transport, 'agents')(9, { active: false })
    await v2Delete(transport, 'agentType')('TP')
    await v2Action(transport, 'PATCH', 'tasks/prioritize')([{ id: 1, priority: 0 }])
    expect(call(0)).toEqual({ path: 'agents', method: 'POST', body: '{"name":"A"}' })
    expect(call(1)).toEqual({ path: 'agents/alt-id/T1', method: 'PUT', body: '{"name":"B"}' })
    expect(call(2)).toEqual({ path: 'agents/9', method: 'PATCH', body: '{"active":false}' })
    expect(call(3)).toEqual({ path: 'agentType/alt-id/TP', method: 'DELETE', body: undefined })
    expect(call(4)).toEqual({ path: 'tasks/prioritize', method: 'PATCH', body: '[{"id":1,"priority":0}]' })
  })

  it('normalize é aplicado antes do envio', async () => {
    const { transport, call } = setup()
    await v2Create<{ d: Date | string }>(transport, 'x', (p) => ({ ...p, d: 'norm' }))({ d: new Date() })
    expect(call(0).body).toBe('{"d":"norm"}')
  })

  it('v2Link monta /path/{ref}/{sub}/{subRef} e exige refs do mesmo tipo', async () => {
    const { transport, call } = setup()
    const link = v2Link<{ mandatory?: 'TRUE' | 'FALSE' }>(transport, 'tasks', 'activity')
    await link.add({ altId: 'OS-1' }, 'VIS', { mandatory: 'TRUE' })
    await link.remove(10, { id: 20 })
    await link.patch(10, 20, { mandatory: 'FALSE' })
    expect(call(0)).toEqual({ path: 'tasks/alt-id/OS-1/activity/alt-id/VIS', method: 'POST', body: '{"mandatory":"TRUE"}' })
    expect(call(1)).toEqual({ path: 'tasks/10/activity/20', method: 'DELETE', body: undefined })
    expect(call(2).method).toBe('PATCH')
    await expect(link.add(10, 'VIS')).rejects.toBeInstanceOf(UmovConfigError)
  })
})

describe('customFieldsFromMap', () => {
  it('string → value; array → values[].internalValue', () => {
    expect(customFieldsFromMap({ regiao: 'sul', tags: ['a', 'b'] })).toEqual([
      { alternativeIdentifier: 'regiao', value: 'sul' },
      { alternativeIdentifier: 'tags', values: [{ internalValue: 'a' }, { internalValue: 'b' }] },
    ])
  })
})
