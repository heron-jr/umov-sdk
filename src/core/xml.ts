import { XMLParser } from 'fast-xml-parser'

/** Espaços em nomes de custom fields viram __ (doc uMov.me). */
export function encodeCustomFieldName(name: string): string {
  return name.replace(/ /g, '__')
}

/** Codificação exigida dentro de CDATA: % → %25, & → %26. Ordem importa (% primeiro). */
export function encodeText(value: string): string {
  return value.replace(/%/g, '%25').replace(/&/g, '%26')
}

/** Decodificação simétrica das respostas (spec §7 R15). Ordem inversa. */
export function decodeText(value: string): string {
  return value.replace(/%26/g, '&').replace(/%25/g, '%')
}

const NEEDS_CDATA = /[<>&%\n\r]/

function serializeValue(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value)
  if (!NEEDS_CDATA.test(value)) return value
  // ']]>' fecharia a seção CDATA prematuramente: divide em seções adjacentes (']]' + '>').
  const escaped = encodeText(value).replace(/]]>/g, ']]]]><![CDATA[>')
  return `<![CDATA[${escaped}]]>`
}

type Scalar = string | number | boolean
type Serializable = Scalar | null | undefined | Serializable[] | { [key: string]: Serializable }

function serializeNode(name: string, value: Serializable): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => serializeNode(name, v)).join('')
  if (typeof value === 'object') {
    if (name === 'customFields') {
      const inner = Object.entries(value)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => {
          const joined = Array.isArray(v) ? (v as Scalar[]).map(String).join('|') : (v as Scalar)
          return serializeNode(encodeCustomFieldName(k), joined)
        })
        .join('')
      return `<customFields>${inner}</customFields>`
    }
    const inner = Object.entries(value)
      .map(([k, v]) => serializeNode(k, v))
      .join('')
    return `<${name}>${inner}</${name}>`
  }
  return `<${name}>${serializeValue(value)}</${name}>`
}

/** Serializa um payload de entidade para o XML aceito pela API. */
export function serializeEntity(rootName: string, payload: Record<string, unknown>): string {
  return serializeNode(rootName, payload as Serializable)
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '$',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
})

function decodeDeep(node: unknown): unknown {
  if (typeof node === 'string') return decodeText(node)
  if (Array.isArray(node)) return node.map(decodeDeep)
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, decodeDeep(v)]))
  }
  return node
}

/** Parseia XML da API em objeto JS. Valores permanecem strings; atributos ganham prefixo $. */
export function parseXml(xml: string): Record<string, unknown> {
  return decodeDeep(parser.parse(xml)) as Record<string, unknown>
}
