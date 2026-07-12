import { describe, expect, it } from 'vitest'
import { serializeEntity, parseXml, encodeCustomFieldName, decodeText } from '../../src/core/xml'

describe('serializeEntity', () => {
  it('serializa objeto plano', () => {
    expect(serializeEntity('agentType', { description: 'Tecnico', active: true })).toBe(
      '<agentType><description>Tecnico</description><active>true</active></agentType>',
    )
  })

  it('serializa objetos aninhados e números', () => {
    expect(serializeEntity('schedule', { agent: { id: 7 }, situation: { id: 70 } })).toBe(
      '<schedule><agent><id>7</id></agent><situation><id>70</id></situation></schedule>',
    )
  })

  it('envolve valores com caracteres especiais em CDATA com %25/%26', () => {
    expect(serializeEntity('item', { description: 'Café 100% & extra <forte>' })).toBe(
      '<item><description><![CDATA[Café 100%25 %26 extra <forte>]]></description></item>',
    )
  })

  it('serializa customFields com nomes encodados e multi-valor pipe', () => {
    const xml = serializeEntity('agent', {
      customFields: { 'numero da nota': '42', regioes: ['0', '1'] },
    })
    expect(xml).toBe(
      '<agent><customFields><numero__da__nota>42</numero__da__nota><regioes>0|1</regioes></customFields></agent>',
    )
  })

  it('omite undefined e null', () => {
    expect(serializeEntity('agent', { name: 'Ana', email: undefined, phone: null })).toBe(
      '<agent><name>Ana</name></agent>',
    )
  })

  it("divide ']]>' em seções CDATA adjacentes e faz round-trip", () => {
    const xml = serializeEntity('item', { description: 'a]]>b' })
    expect(xml).toBe('<item><description><![CDATA[a]]]]><![CDATA[>b]]></description></item>')
    expect(parseXml(xml)).toEqual({ item: { description: 'a]]>b' } })
  })

  it("não permite injeção de elementos via ']]>' no valor", () => {
    const xml = serializeEntity('item', { description: 'x]]><active>false</active>' })
    const parsed = parseXml(xml) as { item: { description: string; active?: unknown } }
    expect(parsed.item.description).toBe('x]]><active>false</active>')
    expect(parsed.item.active).toBeUndefined()
  })

  it('serializa arrays de objetos como elementos repetidos', () => {
    expect(
      serializeEntity('schedules', { schedule: [{ id: 1 }, { id: 2 }] }),
    ).toBe('<schedules><schedule><id>1</id></schedule><schedule><id>2</id></schedule></schedules>')
  })
})

describe('parseXml', () => {
  it('parseia detalhe preservando strings e atributos com prefixo $', () => {
    const obj = parseXml('<agent><id>12</id><name>Ana</name><active>true</active></agent>')
    expect(obj).toEqual({ agent: { id: '12', name: 'Ana', active: 'true' } })
  })

  it('decodifica %25 e %26 em valores de texto', () => {
    const obj = parseXml('<item><description>Café 100%25 %26 extra</description></item>')
    expect(obj).toEqual({ item: { description: 'Café 100% & extra' } })
  })

  it('expõe atributos de entry', () => {
    const obj = parseXml('<entries><entry id="5" link="/agent/5.xml"/></entries>') as {
      entries: { entry: { $id: string; $link: string } }
    }
    expect(obj.entries.entry.$id).toBe('5')
    expect(obj.entries.entry.$link).toBe('/agent/5.xml')
  })
})

describe('encodeCustomFieldName', () => {
  it('troca espaços por __ duplo', () => {
    expect(encodeCustomFieldName('numero da nota fiscal')).toBe('numero__da__nota__fiscal')
  })
})

describe('decodeText', () => {
  it('reverte a codificação de request', () => {
    expect(decodeText('100%25 %26 fim')).toBe('100% & fim')
  })
})
