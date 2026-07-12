import { parseListResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { refToPath, type EntityRef, type ListPage } from '../core/types'
import type { Transport } from '../core/transport'
import type { CustomFieldValues } from './types'

/** Entidades que suportam custom fields via API (doc uMov.me). */
export type CustomFieldOwner = 'agent' | 'serviceLocal' | 'item' | 'schedule' | 'team'

export interface EntityCustomFields {
  list(): Promise<ListPage>
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
      const basePath = `${entity}/${refToPath(ref)}/customField.xml`
      return {
        async list() {
          return parseListResponse(await transport.get(basePath))
        },
        async setValues(values) {
          await transport.post(basePath, serializeEntity('customFields', values))
        },
      }
    },
  }
}
