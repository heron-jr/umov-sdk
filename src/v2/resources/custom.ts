import { v2Create, v2Delete, v2Patch, v2Put, type V2CreateFn, type V2DeleteFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2Bool, V2CustomField, V2CustomFieldEntity, V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `CustomEntityDTO` (cadastro customizável / dataset) — description obrigatório na criação. */
export interface V2CustomEntity {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  /** Rótulo amigável do campo identificador alternativo. */
  labelAlternativeIdentifier?: string
  /** Rótulo amigável do campo descrição. */
  labelDescription?: string
  blockEditing?: V2Bool
  /** Copia os dados no processo de cópia de ambiente. */
  copyStructure?: V2Bool
  sendMobile?: V2Bool
  structural?: V2Bool
  /** Controle interno. */
  userRegistry?: V2Bool
}

/** `CustomEntityDeletionCommand` — DELETE /internal/custom-entities/delete-all (só apaga datasets vazios). */
export interface V2CustomEntityDeletion {
  customEntityAltIds: string[]
}

/** `CustomEntityEntry` (registro do cadastro customizável) — identifique o dataset por `customEntityId` ou `customEntityAltId`. */
/**
 * `CustomEntityEntry`. ATENÇÃO (validado em 2026-10-29): `put`/`patch` por altId exigem `customEntityAltId`
 * (ou `customEntityId`) no corpo mesmo assim — sem ele a API responde `custom_entity_required`.
 */
export interface V2CustomEntityEntry {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  customEntityId?: number
  customEntityAltId?: string
  customFields?: V2CustomField[]
}

export type V2CustomFieldType =
  | 'ALPHANUMERIC'
  | 'CUSTOM_ENTITY_LIST'
  | 'DATE'
  | 'GEOCOORDINATE'
  | 'MULTIMEDIA'
  | 'MULTIVALUED'
  | 'NUMERIC'
  | 'PAYMENT_RECIEVER'
  | 'TIME'

/** Subtipo quando `typeField` é MULTIMEDIA ou CUSTOM_ENTITY_LIST. */
export type V2CustomFieldSubtype =
  | 'MULTIMIDIA_AUDIO'
  | 'MULTIMIDIA_IMAGE'
  | 'MULTIMIDIA_PDF'
  | 'MULTIMIDIA_URL'
  | 'MULTIMIDIA_VIDEO'
  | 'MULTIMIDIA_XML'
  | 'MULTIPLE_LIST'
  | 'SIMPLE_LIST'

/**
 * `Data object de todos os dados refrente ao campo customizavel` — /customField/entity/{entity}.
 * Obrigatórios na criação: `description`, `size`, `typeField`.
 */
export interface V2CustomFieldDefinition {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  size?: number
  typeField?: V2CustomFieldType
  subtypeField?: V2CustomFieldSubtype
  /** DATE: `yyyy-MM-dd`, `dd-MM-yyyy`, `yyyy/MM/dd` ou `dd/MM/yyyy` · TIME: `HH:mm`. */
  defaultValue?: string
  mandatory?: boolean
  editableOnCenter?: boolean
  /** Se bloqueado, não permite edição em ambiente gerado a partir deste. */
  lockedEdition?: boolean
  showFilter?: boolean
  /** Dataset de origem do campo (quando o campo pertence a um cadastro customizável). */
  /** Dataset dono do campo (entidade CUSTOM_ENTITY). Use `{ alternativeIdentifier }` — `{ id }` devolve 404 (validado em 2026-10-29). */
  customEntity?: V2Ref
  /** Campo lista simples/múltipla que tem como origem um dataset. */
  customEntityListReference?: V2Ref
}

// ---------- Recursos ----------

export interface V2CustomEntitiesResource {
  create: V2CreateFn<V2CustomEntity>
  put: V2WriteFn<V2CustomEntity>
  patch: V2WriteFn<V2CustomEntity>
  /** DELETE `/internal/custom-entities/delete-all` com body — só remove datasets sem registros. */
  deleteAll(body: V2CustomEntityDeletion): Promise<V2Result>
}

export interface V2CustomEntityEntriesResource {
  create: V2CreateFn<V2CustomEntityEntry>
  /** PUT `/custom-entity-entry` sem ref — cria ou substitui pelo `alternativeIdentifier` do body. */
  upsert: V2CreateFn<V2CustomEntityEntry>
  put: V2WriteFn<V2CustomEntityEntry>
  patch: V2WriteFn<V2CustomEntityEntry>
  remove: V2DeleteFn
  /** DELETE `/custom-entity-entry/mixItem/{mixId}/{itemId}`. */
  removeMixItem(mixId: number, itemId: number): Promise<V2Result>
}

export interface V2CustomFieldsResource {
  /** POST `/customField/entity/{entity}`. */
  create(entity: V2CustomFieldEntity, body: V2CustomFieldDefinition): Promise<V2Result>
  /** PATCH `/customField/entity/{entity}/alt-id/{altId}` — a spec só expõe por altId. */
  patch(entity: V2CustomFieldEntity, altId: string, body: V2CustomFieldDefinition): Promise<V2Result>
}

export interface V2CustomResources {
  customEntities: V2CustomEntitiesResource
  customEntityEntries: V2CustomEntityEntriesResource
  customFields: V2CustomFieldsResource
}

export function createCustomResources(t: TransportV2): V2CustomResources {
  const fieldPath = (entity: V2CustomFieldEntity) => `customField/entity/${entity}`
  return {
    customEntities: {
      create: v2Create(t, 'custom-entity'),
      put: v2Put(t, 'custom-entity'),
      patch: v2Patch(t, 'custom-entity'),
      deleteAll: (body) => t.delete('internal/custom-entities/delete-all', body),
    },
    customEntityEntries: {
      create: v2Create(t, 'custom-entity-entry'),
      upsert: (body) => t.put('custom-entity-entry', body),
      put: v2Put(t, 'custom-entity-entry'),
      patch: v2Patch(t, 'custom-entity-entry'),
      remove: v2Delete(t, 'custom-entity-entry'),
      removeMixItem: (mixId, itemId) => t.delete(`custom-entity-entry/mixItem/${mixId}/${itemId}`),
    },
    customFields: {
      create: (entity, body) => t.post(fieldPath(entity), body),
      patch: (entity, altId, body) => t.patch(`${fieldPath(entity)}/alt-id/${encodeURIComponent(altId)}`, body),
    },
  }
}
