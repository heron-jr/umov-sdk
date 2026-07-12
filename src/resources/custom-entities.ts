import { defineBatch, defineResource, filtersToQuery, type BatchOptions, type ListOptions } from '../core/resource'
import { parseDetailResponse, parseListResponse, parseWriteResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { refToPath, type EntityRef, type ListPage, type ListStub } from '../core/types'
import type { Transport } from '../core/transport'
import type {
  CustomEntity,
  CustomEntityEntryCreate,
  CustomEntityEntryUpdate,
  CustomEntityFilters,
  SimpleEntity,
  SimpleEntityFilters,
} from './types'

export interface CustomEntityEntriesResource {
  list(filters?: SimpleEntityFilters, opts?: ListOptions): Promise<ListPage>
  get(entryRef: EntityRef): Promise<SimpleEntity>
  create(payload: CustomEntityEntryCreate): Promise<{ id: number }>
  update(entryRef: EntityRef, payload: CustomEntityEntryUpdate): Promise<void>
  /**
   * Upsert em lote por alternativeIdentifier (ATÔMICO).
   * A API só documenta o batch com a ENTIDADE endereçada por altId — exige entityRef por altId.
   */
  upsertBatch(items: CustomEntityEntryCreate[], opts?: BatchOptions): Promise<ListStub[]>
}

export interface CustomEntitiesResource {
  /** Estrutura de cadastros customizáveis é read-only via API (só as entries são editáveis). */
  list(filters?: CustomEntityFilters, opts?: ListOptions): Promise<ListPage>
  get(ref: EntityRef): Promise<CustomEntity>
  entries(entityRef: EntityRef): CustomEntityEntriesResource
}

export function createCustomEntitiesResource(transport: Transport): CustomEntitiesResource {
  const base = defineResource<CustomEntity, never, never, CustomEntityFilters>(transport, { path: 'customEntity' })

  return {
    list: base.list,
    get: base.get,
    entries(entityRef) {
      const entityPath = `customEntity/${refToPath(entityRef)}`
      return {
        async list(filters, opts) {
          const query = filtersToQuery(filters ?? {})
          if (opts?.page !== undefined) query['paging.page'] = String(opts.page)
          return parseListResponse(await transport.get(`${entityPath}/customEntityEntry.xml`, query))
        },
        async get(entryRef) {
          return parseDetailResponse<SimpleEntity>(
            await transport.get(`${entityPath}/customEntityEntry/${refToPath(entryRef)}.xml`),
            'customEntityEntry',
          )
        },
        async create(payload) {
          const xml = serializeEntity('customEntityEntry', payload as unknown as Record<string, unknown>)
          const res = parseWriteResponse(await transport.post(`${entityPath}/customEntityEntry.xml`, xml))
          if (res.id === undefined) throw new Error('Create de customEntityEntry respondeu sem <resourceId>')
          return { id: res.id }
        },
        async update(entryRef, payload) {
          const xml = serializeEntity('customEntityEntry', payload as Record<string, unknown>)
          parseWriteResponse(await transport.post(`${entityPath}/customEntityEntry/${refToPath(entryRef)}.xml`, xml))
        },
        upsertBatch(items, opts) {
          if (typeof entityRef === 'number' || (typeof entityRef === 'object' && 'id' in entityRef)) {
            return Promise.reject(
              new Error('upsertBatch de customEntityEntries exige a entidade por altId (forma documentada pela API)'),
            )
          }
          const altId = typeof entityRef === 'string' ? entityRef : entityRef.altId
          return defineBatch<CustomEntityEntryCreate>(transport, {
            path: `customEntity/alternativeIdentifier/${encodeURIComponent(altId)}/customEntityEntries`,
            wrapper: 'customEntityEntries',
            itemRoot: 'customEntityEntry',
            max: 100,
          })(items, opts)
        },
      }
    },
  }
}
