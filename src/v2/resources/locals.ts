import type { EntityRef } from '../../core/types'
import { assertSameRefKind, idOf, refToV2Path, v2Create, v2Delete, v2Link, v2Patch, v2Put, type V2CreateFn, type V2DeleteFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2Bool, V2Contact, V2CustomField, V2CustomFieldEntity, V2IdRef, V2Image, V2LocalAddress, V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `Contrato referente ao local de atendimento no umov.me` — POST /locals, PUT|PATCH /locals/{ref}. */
export interface V2Local {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  /** Razão social. */
  corporateName?: string
  observation?: string
  /** Complemento do logradouro. */
  complemento?: string
  /** Tempo médio de atendimento (minutos). */
  averageServiceTime?: number
  /** Frequência de atendimento planejada (em 1 semana). */
  plannedAttendanceFrequency?: number
  /** '0' novo · '1' exportado · '2' exportado e alterado. */
  exportStatus?: string
  accountable?: V2Ref
  classification?: V2Ref
  group?: V2Ref
  team?: V2Ref
  type?: V2Ref
  activities?: V2Ref[]
  address?: V2LocalAddress
  contactDTO?: V2Contact
  image?: V2Image
  customFields?: V2CustomField[]
}

/** `Contrato referente ao tipo de local no umov.me` — description e localFilter obrigatórios na criação. */
export interface V2LocalType {
  description?: string
  alternativeIdentifier?: string
  active?: V2Bool
  localFilter?: 'DESTINATION' | 'ORIGIN' | 'ORIGIN_AND_DESTINATION'
}

/** `Contrato referente à entidade Tag no umov.me` — entity obrigatório na criação. */
export interface V2Tag {
  entity?: V2CustomFieldEntity
  alternativeIdentifier?: string
  text?: string
  active?: V2Bool
  allowFilter?: V2Bool
  showCard?: V2Bool
  /** Hex (ex.: `#FFFFFF`). */
  backgroundColor?: string
  /** Hex (ex.: `#000000`). */
  fontColor?: string
  displayOrder?: number
}

/** `Contrato referente ao vinculo entre local e tag` — PATCH /locals/{ref}/tag/{ref}. */
export interface V2LocalTagLink {
  local?: V2Ref
  tag?: V2Ref
}

/** `CustomFieldLocalItemDTO` — PATCH /locals/{ref}/item/{ref}/custom-field/{ref}. */
export interface V2LocalItemCustomField {
  customField: V2CustomField
}

/** A spec não documenta o body do POST/PATCH `/locals/{ref}/activity/{ref}` — livre. */
export type V2LocalActivityPatch = Record<string, unknown>

// ---------- Recursos ----------

export interface V2LocalsResource {
  create: V2CreateFn<V2Local>
  put: V2WriteFn<V2Local>
  patch: V2WriteFn<V2Local>
  /** `/locals/{ref}/activity/{ref}` — refs do mesmo tipo (id/id ou altId/altId). */
  activities: {
    add(localRef: EntityRef, activityRef: EntityRef, body?: V2LocalActivityPatch): Promise<V2Result>
    remove(localRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
    patch(localRef: EntityRef, activityRef: EntityRef, body: V2LocalActivityPatch): Promise<V2Result>
  }
  /** `/locals/{ref}/item/{ref}` — refs do mesmo tipo. */
  items: {
    add(localRef: EntityRef, itemRef: EntityRef): Promise<V2Result>
    remove(localRef: EntityRef, itemRef: EntityRef): Promise<V2Result>
    /** PATCH `/locals/{ref}/item/{ref}/custom-field/{ref}` — as três refs do mesmo tipo. */
    patchCustomField(localRef: EntityRef, itemRef: EntityRef, fieldRef: EntityRef, body: V2LocalItemCustomField): Promise<V2Result>
  }
  /** `/locals/{ref}/tag/{ref}` — refs do mesmo tipo. */
  tags: {
    add(localRef: EntityRef, tagRef: EntityRef): Promise<V2Result>
    remove(localRef: EntityRef, tagRef: EntityRef): Promise<V2Result>
    patch(localRef: EntityRef, tagRef: EntityRef, body: V2LocalTagLink): Promise<V2Result>
  }
}

export interface V2LocalTypesResource {
  create: V2CreateFn<V2LocalType>
  patch: V2WriteFn<V2LocalType>
  remove: V2DeleteFn
}

export interface V2LocalGroupsResource {
  remove(ref: V2IdRef): Promise<V2Result>
}

export interface V2LocalClassificationsResource {
  remove(ref: V2IdRef): Promise<V2Result>
}

export interface V2TagsResource {
  create: V2CreateFn<V2Tag>
  patch: V2WriteFn<V2Tag>
}

export interface V2LocalResources {
  locals: V2LocalsResource
  localTypes: V2LocalTypesResource
  localGroups: V2LocalGroupsResource
  localClassifications: V2LocalClassificationsResource
  tags: V2TagsResource
}

export function createLocalResources(t: TransportV2): V2LocalResources {
  const localActivities = v2Link<V2LocalActivityPatch>(t, 'locals', 'activity')
  const localItems = v2Link(t, 'locals', 'item')
  const localTags = v2Link<V2LocalTagLink>(t, 'locals', 'tag')
  // async para que a validação de refs rejeite a promise em vez de lançar síncrono
  const patchItemCustomField = async (localRef: EntityRef, itemRef: EntityRef, fieldRef: EntityRef, body: V2LocalItemCustomField) => {
    assertSameRefKind(localRef, itemRef, 'locals/item')
    assertSameRefKind(itemRef, fieldRef, 'locals/item/custom-field')
    return t.patch(`locals/${refToV2Path(localRef)}/item/${refToV2Path(itemRef)}/custom-field/${refToV2Path(fieldRef)}`, body)
  }
  return {
    locals: {
      create: v2Create(t, 'locals'),
      put: v2Put(t, 'locals'),
      patch: v2Patch(t, 'locals'),
      activities: { add: localActivities.add, remove: localActivities.remove, patch: localActivities.patch },
      items: { add: (a, b) => localItems.add(a, b), remove: localItems.remove, patchCustomField: patchItemCustomField },
      tags: { add: (a, b) => localTags.add(a, b), remove: localTags.remove, patch: localTags.patch },
    },
    localTypes: {
      create: v2Create(t, 'localTypes'),
      patch: v2Patch(t, 'localTypes'),
      remove: v2Delete(t, 'localTypes'),
    },
    localGroups: {
      remove: (ref) => t.delete(`localGroups/${idOf(ref)}`),
    },
    localClassifications: {
      remove: (ref) => t.delete(`localClassifications/${idOf(ref)}`),
    },
    tags: {
      create: v2Create(t, 'tags'),
      patch: v2Patch(t, 'tags'),
    },
  }
}
