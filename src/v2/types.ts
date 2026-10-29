import type { RelationRef } from '../core/types'

/** Referência a outro recurso na v2 (`Entidade de relacionamento`): `{ id }` ou `{ alternativeIdentifier }`. */
export type V2Ref = RelationRef

/** Alguns DTOs da v2 usam enum string no lugar de boolean (activity, section, tag, systemParameters…). */
export type V2Bool = 'TRUE' | 'FALSE'

/** Campo documentado como `yyyy-MM-dd`: aceita Date (formatado pelo SDK) ou string já no formato. */
export type V2DateInput = Date | string

/** `operationMessages[]` do envelope: `key` é a chave estável de negócio, `value` a mensagem traduzida. */
export interface V2Message {
  key: string
  value: string
}

/** Envelope `ApiReturn` da v2 já normalizado pelo Transport. */
export interface V2Result {
  code: number
  /** `id` do recurso criado/afetado quando a API devolve um valor numérico. */
  id?: number
  /** `id` cru como veio da API (string), para os casos não numéricos. */
  rawId?: string
  messages: V2Message[]
  /** Corpo original quando a resposta não é JSON válido. */
  raw?: string
}

/** `Dados de uma imagem`: id de mídia existente OU url para importar. */
export interface V2Image {
  id?: string
  url?: string
}

export interface V2CustomFieldValue {
  customFieldValueId?: number
  value?: string
  internalValue?: string
  externalValue?: string
}

/**
 * `Campo customizável` da v2 (array, não mapa). Identifique o campo por `alternativeIdentifier` ou `id`.
 * - simples: `value`
 * - lista (cadastro customizável): `internalValue` + `externalValue`
 * - multivalorado: `values[]`
 */
export interface V2CustomField {
  id?: number
  alternativeIdentifier?: string
  value?: string
  internalValue?: string
  externalValue?: string
  values?: V2CustomFieldValue[]
}

export interface V2PhoneContact {
  ddi?: number
  ddd?: number
  number?: number
}

export interface V2Contact {
  email?: string
  phone?: V2PhoneContact
  cellphone?: V2PhoneContact
}

/** `Dados de endereço do agente`. */
export interface V2AgentAddress {
  streetType?: string
  street?: string
  streetNumber?: number
  streetComplement?: string
  neighborhood?: string
  city?: string
  state?: string
  country?: string
  zipCode?: number
  /** `"lat,lng"` (ex.: `"-30.0440695,-51.1739015"`). */
  geoCoordinate?: string
}

/** `Dados de endereço do local`. */
export interface V2LocalAddress {
  streetType?: string
  street?: string
  streetNumber?: number
  /** Número alfanumérico. */
  addressNumber?: string
  streetComplement?: string
  neighborhood?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  /** `"lat,lng"`. */
  geoCoordinate?: string
  /** true = geocodifica de forma síncrona; false = assíncrona. */
  processGeocoordinate?: boolean
}

/** Entidades que aceitam custom fields e tags na v2 (`/customField/entity/{entityName}`). */
export type V2CustomFieldEntity =
  | 'AGENT'
  | 'CUSTOM_ENTITY'
  | 'ITEM'
  | 'LOCAL_ACTIVITY'
  | 'LOCAL_ITEM'
  | 'SERVICE_LOCAL'
  | 'TASK'
  | 'TASK_ITEM'

/**
 * Ponte para quem usa o estilo v1 (`{ campo: 'valor' }`): converte um mapa em `V2CustomField[]`.
 * `string` → `{ alternativeIdentifier, value }`; `string[]` → `{ alternativeIdentifier, values: [{ internalValue }] }`.
 */
export function customFieldsFromMap(map: Record<string, string | string[]>): V2CustomField[] {
  return Object.entries(map).map(([alternativeIdentifier, v]) =>
    Array.isArray(v)
      ? { alternativeIdentifier, values: v.map((internalValue) => ({ internalValue })) }
      : { alternativeIdentifier, value: v },
  )
}
