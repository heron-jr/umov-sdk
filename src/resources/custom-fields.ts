import { parseDetailResponse, parseListResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { filtersToQuery } from '../core/resource'
import { refToPath, type EntityRef, type ListPage } from '../core/types'
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
  list(filters?: CustomFieldFilters): Promise<ListPage>
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
      return {
        async list(filters) {
          return parseListResponse(await transport.get(`${entityPath}/customField.xml`, filtersToQuery(filters ?? {})))
        },
        async get(fieldRef) {
          return parseDetailResponse<CustomFieldEntry>(
            await transport.get(`${entityPath}/customField/${refToPath(fieldRef)}.xml`),
            'customField',
          )
        },
        async setValues(values) {
          await transport.post(`${entityPath}/customField.xml`, serializeEntity('customFields', values))
        },
      }
    },
  }
}
