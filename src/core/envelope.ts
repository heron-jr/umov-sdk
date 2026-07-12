import { parseXml } from './xml'
import type { ListPage, ListStub } from './types'

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

export function parseListResponse(xml: string): ListPage {
  const doc = parseXml(xml) as {
    result?: { size?: string; entries?: { entry?: unknown } }
  }
  if (!doc.result) throw new Error('Resposta de lista sem <result>')
  const entries: ListStub[] = asArray(
    doc.result.entries?.entry as { $id: string; $link?: string } | Array<{ $id: string; $link?: string }> | undefined,
  ).map((e) => ({ id: Number(e.$id), link: e.$link ?? '' }))
  return { size: Number(doc.result.size ?? entries.length), entries }
}

export function parseWriteResponse(xml: string): { resourceName: string; id: number; link?: string } {
  const doc = parseXml(xml) as {
    result?: { resourceName?: string; resourceId?: string; link?: string }
  }
  if (!doc.result?.resourceId) throw new Error('Resposta de escrita sem <resourceId>')
  return {
    resourceName: doc.result.resourceName ?? '',
    id: Number(doc.result.resourceId),
    link: doc.result.link,
  }
}

/** Flags booleanas documentadas da API — texto livre ('true' digitado num campo) NUNCA vira boolean. */
const BOOLEAN_KEYS = new Set(['active', 'mandatory', 'responsible'])

/** Coerção conservadora: chave `id` numérica → number; flags conhecidas 'true'/'false' → boolean. */
function coerceDeep(node: unknown, key?: string): unknown {
  if (typeof node === 'string') {
    if (key === 'id' && /^\d+$/.test(node)) return Number(node)
    if (key !== undefined && BOOLEAN_KEYS.has(key)) {
      if (node === 'true') return true
      if (node === 'false') return false
    }
    return node
  }
  if (Array.isArray(node)) return node.map((n) => coerceDeep(n, key))
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, coerceDeep(v, k)]))
  }
  return node
}

export function parseDetailResponse<T>(xml: string, rootName: string): T {
  const doc = parseXml(xml)
  const root = doc[rootName]
  if (root === undefined) throw new Error(`Resposta sem raiz <${rootName}>`)
  return coerceDeep(root) as T
}
