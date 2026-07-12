import { describe, expect, it } from 'vitest'
import { parseListResponse, parseWriteResponse, parseDetailResponse } from '../../src/core/envelope'

describe('parseListResponse', () => {
  it('extrai size e stubs', () => {
    const xml = `<result><resourceName>agent</resourceName><size>2</size><entries>
      <entry id="10" link="/agent/10.xml"/><entry id="11" link="/agent/11.xml"/>
    </entries></result>`
    expect(parseListResponse(xml)).toEqual({
      size: 2,
      entries: [
        { id: 10, link: '/agent/10.xml' },
        { id: 11, link: '/agent/11.xml' },
      ],
    })
  })

  it('lida com entry único (não-array)', () => {
    const xml = `<result><size>1</size><entries><entry id="7" link="/agent/7.xml"/></entries></result>`
    expect(parseListResponse(xml).entries).toEqual([{ id: 7, link: '/agent/7.xml' }])
  })

  it('lida com lista vazia sem <entries>', () => {
    const xml = `<result><resourceName>agent</resourceName><size>0</size></result>`
    expect(parseListResponse(xml)).toEqual({ size: 0, entries: [] })
  })
})

describe('parseWriteResponse', () => {
  it('extrai resourceId', () => {
    const xml = `<result><resourceName>schedule</resourceName><resourceId>555</resourceId><link>/schedule/555.xml</link></result>`
    expect(parseWriteResponse(xml)).toEqual({ resourceName: 'schedule', id: 555, link: '/schedule/555.xml' })
  })
})

describe('parseDetailResponse', () => {
  it('desembrulha a raiz e coerce id/active', () => {
    const xml = `<agent><id>12</id><name>Ana</name><active>true</active><agentType><id>3</id><description>Tec</description></agentType></agent>`
    expect(parseDetailResponse(xml, 'agent')).toEqual({
      id: 12,
      name: 'Ana',
      active: true,
      agentType: { id: 3, description: 'Tec' },
    })
  })

  it('lança se a raiz esperada não existe', () => {
    expect(() => parseDetailResponse('<other/>', 'agent')).toThrow(/agent/)
  })
})
