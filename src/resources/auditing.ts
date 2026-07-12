import { defineResource, filtersToQuery, type ListOptions } from '../core/resource'
import { parseXml } from '../core/xml'
import type { EntityRef, ListPage } from '../core/types'
import type { Transport } from '../core/transport'

export interface AuditingFilters {
  /** id do activityHistory. */
  history?: number
  raw?: Record<string, string>
  [key: string]: unknown
}

export interface AuditingValueFilters {
  keyInformation?: string
  raw?: Record<string, string>
  [key: string]: unknown
}

/** Dados de auditoria do device (modelo, OS, IMEI, bateria...) — read-only, Android v04.54+. */
export interface AuditingResource {
  list(filters?: AuditingFilters, opts?: ListOptions): Promise<ListPage>
  get(ref: EntityRef): Promise<Record<string, unknown>>
  values: {
    list(filters?: AuditingValueFilters, opts?: ListOptions): Promise<ListPage>
    get(ref: EntityRef): Promise<Record<string, unknown>>
  }
  /**
   * Auditoria hierárquica de um history; `values` filtra os campos retornados
   * (ex.: ['PlatformOS', 'IMEI']). Shape não documentado — retorna a árvore parseada.
   */
  hierarchical(historyId: number, values?: string[]): Promise<Record<string, unknown>>
}

export function createAuditingResource(transport: Transport): AuditingResource {
  const base = defineResource<Record<string, unknown>, never, never, AuditingFilters>(transport, { path: 'auditing' })
  const valuesBase = defineResource<Record<string, unknown>, never, never, AuditingValueFilters>(transport, {
    path: 'auditingValue',
  })
  return {
    list: base.list,
    get: base.get,
    values: { list: valuesBase.list, get: valuesBase.get },
    async hierarchical(historyId, values) {
      const query = filtersToQuery(values?.length ? { values: values.join(',') } : {})
      return parseXml(await transport.get(`auditingHierarchical/${historyId}.xml`, query))
    },
  }
}
