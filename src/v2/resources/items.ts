import { idOf, v2Action, v2Create, v2Patch, v2Put, type V2CreateFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2CustomField, V2IdRef, V2Image, V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `Data object de dados do item` — POST|PUT /item, PUT|PATCH /item/{ref}. */
export interface V2Item {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  itemCategory?: V2Ref
  subGroup?: V2Ref
  image?: V2Image
  customFields?: V2CustomField[]
  showInCenterWeb?: boolean
  /** Tags do item (string única, como na spec). */
  tags?: string
}

/** `Data object de dados do subgroup` — POST /subgroup, PUT|PATCH /subgroup/{ref}. */
export interface V2SubGroup {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  group?: V2Ref
  image?: V2Image
  orderView?: number
  showInCenterWeb?: boolean
}

/** `AditionalInfoItemRequest` — todos obrigatórios. */
export interface V2AdditionalInfoItem {
  active: boolean
  /** 1–200 caracteres. */
  featuredInfo: string
  itemId: number
  sectionId: number
  serviceLocalId: number
}

// ---------- Recursos ----------

export interface V2ItemsResource {
  create: V2CreateFn<V2Item>
  /** PUT `/item` sem ref — cria ou atualiza pelo `alternativeIdentifier` do body. */
  upsert: V2CreateFn<V2Item>
  put: V2WriteFn<V2Item>
  patch: V2WriteFn<V2Item>
}

export interface V2SubGroupsResource {
  create: V2CreateFn<V2SubGroup>
  put: V2WriteFn<V2SubGroup>
  patch: V2WriteFn<V2SubGroup>
}

/** `/aditional-info-items` — grafia da API. */
export interface V2AdditionalInfoItemsResource {
  create: V2CreateFn<V2AdditionalInfoItem>
  put(ref: V2IdRef, body: V2AdditionalInfoItem): Promise<V2Result>
}

export interface V2ItemResources {
  items: V2ItemsResource
  subGroups: V2SubGroupsResource
  additionalInfoItems: V2AdditionalInfoItemsResource
}

export function createItemResources(t: TransportV2): V2ItemResources {
  return {
    items: {
      create: v2Create(t, 'item'),
      upsert: v2Action(t, 'PUT', 'item'),
      put: v2Put(t, 'item'),
      patch: v2Patch(t, 'item'),
    },
    subGroups: {
      create: v2Create(t, 'subgroup'),
      put: v2Put(t, 'subgroup'),
      patch: v2Patch(t, 'subgroup'),
    },
    additionalInfoItems: {
      create: v2Create(t, 'aditional-info-items'),
      put: (ref, body) => t.put(`aditional-info-items/${idOf(ref)}`, body),
    },
  }
}
