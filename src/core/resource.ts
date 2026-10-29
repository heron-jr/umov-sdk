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

export interface BatchConfig {
  /** Segmento plural do path: POST /batch/{path}.xml */
  path: string
  /** Elemento raiz do lote (ex.: 'schedules'). */
  wrapper: string
  /** Elemento de cada item (ex.: 'schedule'). */
  itemRoot: string
  /** Máximo de itens por lote (100; schedules 50). */
  max: number
}

export interface BatchOptions {
  /** Divide em lotes de `max` POSTados em sequência — CADA LOTE é atômico separadamente. */
  chunked?: boolean
}

/**
 * Batch da uMov.me: upsert por alternativeIdentifier, ATÔMICO — qualquer erro aborta o lote inteiro.
 * Retorna os stubs (id + link) dos registros criados/atualizados.
 */
export function defineBatch<TItem>(
  transport: Transport,
  cfg: BatchConfig,
): (items: TItem[], opts?: BatchOptions) => Promise<ListStub[]> {
  return async (items, opts) => {
    if (items.length === 0) return []
    if (items.length > cfg.max && !opts?.chunked) {
      throw new RangeError(
        `Batch de ${cfg.path} aceita no máximo ${cfg.max} itens por chamada (recebeu ${items.length}). ` +
          `Use { chunked: true } para dividir — mas cada lote passa a ser atômico separadamente.`,
      )
    }
    const stubs: ListStub[] = []
    for (let i = 0; i < items.length; i += cfg.max) {
      const chunk = items.slice(i, i + cfg.max)
      const xml = serializeEntity(cfg.wrapper, { [cfg.itemRoot]: chunk } as Record<string, unknown>)
      const res = parseListResponse(await transport.post(`batch/${cfg.path}.xml`, xml))
      stubs.push(...res.entries)
    }
    return stubs
  }
}

/**
 * DELETE por id interno — só existe para entidades de vínculo (master data se desativa com active=false).
 * A API não documenta DELETE por altId avulso em nenhum vínculo; para altIds use deleteByPair.
 */
export function defineDelete(transport: Transport, path: string): (ref: number | { id: number }) => Promise<void> {
  return async (ref) => {
    const id = typeof ref === 'number' ? ref : ref.id
    await transport.delete(`${path}/${id}.xml`)
  }
}

export interface Resource<TDetail, TCreate, TUpdate, TFilters> {
  list(filters?: TFilters, opts?: ListOptions): Promise<ListPage>
  iterate(filters: TFilters | undefined, opts: IterateOptions & { hydrate: true }): AsyncGenerator<TDetail>
  iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  /**
   * Existe algum registro que case com os filtros? Faz UMA requisição (primeira página do list)
   * e nunca pagina além dela — evita iterar só para checar `length > 0`.
   */
  exists(filters?: TFilters): Promise<boolean>
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

  function iterate(filters: TFilters | undefined, opts: IterateOptions & { hydrate: true }): AsyncGenerator<TDetail>
  function iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  function iterate(
    filters?: TFilters,
    opts?: IterateOptions,
  ): AsyncGenerator<TDetail> | AsyncGenerator<ListStub> {
    const stubs = iterateStubs((page) => list(filters, { page }), transport.pageSize)
    if (opts?.hydrate) return hydrateStubs(stubs, (id) => get(id), opts.prefetch)
    return stubs
  }

  return {
    list,
    get,
    iterate,
    async exists(filters?: TFilters): Promise<boolean> {
      const { entries } = await list(filters)
      return entries.length > 0
    },
    async create(payload: TCreate): Promise<{ id: number }> {
      const xml = serializeEntity(rootName, payload as Record<string, unknown>)
      const res = parseWriteResponse(await transport.post(`${path}.xml`, xml))
      if (res.id === undefined) throw new Error(`Create de ${path} respondeu sem <resourceId>`)
      return { id: res.id }
    },
    async update(ref: EntityRef, payload: TUpdate): Promise<void> {
      const xml = serializeEntity(rootName, payload as Record<string, unknown>)
      parseWriteResponse(await transport.post(`${path}/${refToPath(ref)}.xml`, xml))
    },
  }
}
