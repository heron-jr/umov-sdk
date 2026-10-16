import { parseDetailResponse, parseListResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { filtersToQuery, type IterateOptions, type ListOptions } from '../core/resource'
import { hydrateStubs, iterateStubs } from '../core/pagination'
import { refToPath, type EntityRef, type ListPage, type ListStub } from '../core/types'
import type { Transport } from '../core/transport'
import type { CustomFieldEntry, CustomFieldValues } from './types'

/**
 * Entidades documentadas como portadoras de custom fields via API.
 * A union é aberta (`string & {}`) porque a doc é incompleta — valide contra o ambiente.
 */
export type CustomFieldOwner =
  | 'agent'
  | 'serviceLocal'
  | 'item'
  | 'schedule'
  | 'scheduleItem'
  | 'serviceLocalActivity'
  | 'customEntityEntry'
  | (string & {})

export interface CustomFieldFilters {
  description?: string
  active?: boolean
  raw?: Record<string, string>
  [key: string]: unknown
}

export interface EntityCustomFields {
  /**
   * Lista APENAS stubs (`{ id, link }`): nome e valor do campo NÃO voltam na listagem.
   * Para ler nome/valor use `get`, ou `iterate` com `{ hydrate: true }`.
   */
  list(filters?: CustomFieldFilters, opts?: ListOptions): Promise<ListPage>
  /**
   * Auto-paginação da listagem. Sem `hydrate` rende stubs; com `{ hydrate: true }` rende
   * os campos completos (nome e valor), buscando cada um via `get`.
   */
  iterate(filters: CustomFieldFilters | undefined, opts: IterateOptions & { hydrate: true }): AsyncGenerator<CustomFieldEntry>
  iterate(filters?: CustomFieldFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  /** Lê um custom field individual (valor incluído) por id ou altId do campo. */
  get(fieldRef: EntityRef): Promise<CustomFieldEntry>
  /**
   * Grava valores de custom fields.
   * ATENÇÃO: em campos multi-valorados a API SUBSTITUI todos os valores existentes.
   */
  setValues(values: CustomFieldValues): Promise<void>
}

export interface CustomFieldsAccessor {
  of(entity: CustomFieldOwner, ref: EntityRef): EntityCustomFields
}

export function createCustomFieldsAccessor(transport: Transport): CustomFieldsAccessor {
  return {
    of(entity, ref) {
      const entityPath = `${entity}/${refToPath(ref)}`
      const list = async (filters?: CustomFieldFilters, opts?: ListOptions): Promise<ListPage> => {
        const query = filtersToQuery(filters ?? {})
        if (opts?.page !== undefined) query['paging.page'] = String(opts.page)
        return parseListResponse(await transport.get(`${entityPath}/customField.xml`, query))
      }
      const get = async (fieldRef: EntityRef): Promise<CustomFieldEntry> =>
        parseDetailResponse<CustomFieldEntry>(
          await transport.get(`${entityPath}/customField/${refToPath(fieldRef)}.xml`),
          'customField',
        )

      function iterate(
        filters: CustomFieldFilters | undefined,
        opts: IterateOptions & { hydrate: true },
      ): AsyncGenerator<CustomFieldEntry>
      function iterate(filters?: CustomFieldFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
      function iterate(
        filters?: CustomFieldFilters,
        opts?: IterateOptions,
      ): AsyncGenerator<CustomFieldEntry> | AsyncGenerator<ListStub> {
        const stubs = iterateStubs((page) => list(filters, { page }))
        if (opts?.hydrate) return hydrateStubs(stubs, (id) => get(id), opts.prefetch)
        return stubs
      }

      return {
        list,
        get,
        iterate,
        async setValues(values) {
          await transport.post(`${entityPath}/customField.xml`, serializeEntity('customFields', values))
        },
      }
    },
  }
}
