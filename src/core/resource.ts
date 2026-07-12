import { parseDetailResponse, parseListResponse, parseWriteResponse } from './envelope'
import { serializeEntity } from './xml'
import { hydrateStubs, iterateStubs } from './pagination'
import { refToPath, type EntityRef, type ListPage, type ListStub } from './types'
import type { Transport } from './transport'
import { formatDateTime } from '../util/datetime'

export interface ResourceConfig {
  /** Segmento do path e nome do elemento raiz do XML (ex.: 'agent'). */
  path: string
  /** Raiz do XML quando difere do path (ex.: path 'importfiles', raiz 'import'). */
  rootName?: string
}

export interface ListOptions {
  page?: number
}

export interface IterateOptions {
  hydrate?: boolean
  prefetch?: number
}

/** Filtros tipados viram query string; `raw` passa parâmetros arbitrários (spec §7 R13). */
export function filtersToQuery(filters: Record<string, unknown>): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue
    if (key === 'raw') {
      Object.assign(query, value as Record<string, string>)
      continue
    }
    if (value instanceof Date) query[key] = formatDateTime(value)
    else query[key] = String(value)
  }
  return query
}

export interface Resource<TDetail, TCreate, TUpdate, TFilters> {
  list(filters?: TFilters, opts?: ListOptions): Promise<ListPage>
  iterate(filters?: TFilters, opts?: IterateOptions & { hydrate: true }): AsyncGenerator<TDetail>
  iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  get(ref: EntityRef): Promise<TDetail>
  create(payload: TCreate): Promise<{ id: number }>
  update(ref: EntityRef, payload: TUpdate): Promise<void>
}

export function defineResource<TDetail, TCreate, TUpdate, TFilters extends Record<string, unknown>>(
  transport: Transport,
  config: ResourceConfig,
): Resource<TDetail, TCreate, TUpdate, TFilters> {
  const { path } = config
  const rootName = config.rootName ?? path

  const list = async (filters?: TFilters, opts?: ListOptions): Promise<ListPage> => {
    const query = filtersToQuery(filters ?? {})
    if (opts?.page !== undefined) query['paging.page'] = String(opts.page)
    return parseListResponse(await transport.get(`${path}.xml`, query))
  }

  const get = async (ref: EntityRef): Promise<TDetail> =>
    parseDetailResponse<TDetail>(await transport.get(`${path}/${refToPath(ref)}.xml`), rootName)

  function iterate(filters?: TFilters, opts?: IterateOptions & { hydrate: true }): AsyncGenerator<TDetail>
  function iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  function iterate(
    filters?: TFilters,
    opts?: IterateOptions,
  ): AsyncGenerator<TDetail> | AsyncGenerator<ListStub> {
    const stubs = iterateStubs((page) => list(filters, { page }))
    if (opts?.hydrate) return hydrateStubs(stubs, (id) => get(id), opts.prefetch)
    return stubs
  }

  return {
    list,
    get,
    iterate,
    async create(payload: TCreate): Promise<{ id: number }> {
      const xml = serializeEntity(rootName, payload as Record<string, unknown>)
      const res = parseWriteResponse(await transport.post(`${path}.xml`, xml))
      return { id: res.id }
    },
    async update(ref: EntityRef, payload: TUpdate): Promise<void> {
      const xml = serializeEntity(rootName, payload as Record<string, unknown>)
      parseWriteResponse(await transport.post(`${path}/${refToPath(ref)}.xml`, xml))
    },
  }
}
