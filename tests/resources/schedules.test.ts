import { describe, expect, it, vi } from 'vitest'
import { createSchedulesResource } from '../../src/resources/schedules'
import { Transport } from '../../src/core/transport'

const writeXml = `<result><resourceName>schedule</resourceName><resourceId>42</resourceId></result>`

function make() {
  const fetchMock = vi.fn(async () => new Response(writeXml, { status: 200 }))
  const transport = new Transport({
    apiKey: 'k',
    requestsPerSecond: 1000,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { schedules: createSchedulesResource(transport), fetchMock }
}

describe('schedules.create', () => {
  it('serializa date como YYYY-MM-DD', async () => {
    const { schedules, fetchMock } = make()
    await schedules.create({
      agent: { id: 1 },
      serviceLocal: { alternativeIdentifier: 'L-1' },
      date: new Date(2026, 6, 15),
      hour: '09:00',
    })
    const [, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe(
      '<schedule><agent><id>1</id></agent><serviceLocal><alternativeIdentifier>L-1</alternativeIdentifier></serviceLocal><date>2026-07-15</date><hour>09:00</hour></schedule>',
    )
  })
})

describe('schedules.cancel', () => {
  it('POSTa situation.id=70 no path do ref', async () => {
    const { schedules, fetchMock } = make()
    await schedules.cancel({ altId: 'OS-9' })
    const [url, init] = fetchMock.mock.calls[0]! as unknown as [string, RequestInit]
    expect(url).toContain('/schedule/alternativeIdentifier/OS-9.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe('<schedule><situation><id>70</id></situation></schedule>')
  })
})
