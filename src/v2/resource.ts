import { UmovConfigError } from '../core/errors'
import type { EntityRef } from '../core/types'
import type { TransportV2, V2Method } from './transport'
import type { V2Result } from './types'

/**
 * Endereçamento da v2 (docs/api-v2.md §1):
 * - `number` ou `{ id }` → `{id}`
 * - `string` ou `{ altId }` → `alt-id/{altId}`
 */
export function refToV2Path(ref: EntityRef): string {
  if (typeof ref === 'number') return String(ref)
  if (typeof ref === 'string') return `alt-id/${encodeURIComponent(ref)}`
  if ('id' in ref) return String(ref.id)
  return `alt-id/${encodeURIComponent(ref.altId)}`
}

export function isAltRef(ref: EntityRef): boolean {
  return typeof ref === 'string' || (typeof ref === 'object' && 'altId' in ref)
}

/** Valor cru da referência (id numérico ou altId), sem o prefixo `alt-id/`. */
export function refValue(ref: EntityRef): string {
  if (typeof ref === 'number') return String(ref)
  if (typeof ref === 'string') return ref
  return 'id' in ref ? String(ref.id) : ref.altId
}

/**
 * Vínculos da v2 exigem o MESMO tipo de referência nos dois lados:
 * `/tasks/{id}/activity/{id}` ou `/tasks/alt-id/{a}/activity/alt-id/{b}` — não existe forma mista.
 */
export function assertSameRefKind(a: EntityRef, b: EntityRef, context: string): void {
  if (isAltRef(a) !== isAltRef(b)) {
    throw new UmovConfigError(
      `${context}: as duas referências precisam ser do mesmo tipo (ambas id ou ambas altId) — a API v2 não aceita forma mista`,
    )
  }
}

export type V2CreateFn<T> = (payload: T) => Promise<V2Result>
export type V2WriteFn<T> = (ref: EntityRef, payload: T) => Promise<V2Result>
export type V2DeleteFn = (ref: EntityRef) => Promise<V2Result>

/** POST `/path` */
export function v2Create<T>(transport: TransportV2, path: string, normalize?: (p: T) => T): V2CreateFn<T> {
  return (payload) => transport.post(path, normalize ? normalize(payload) : payload)
}

/** PUT `/path/{ref}` — substituição total. */
export function v2Put<T>(transport: TransportV2, path: string, normalize?: (p: T) => T): V2WriteFn<T> {
  return (ref, payload) => transport.put(`${path}/${refToV2Path(ref)}`, normalize ? normalize(payload) : payload)
}

/** PATCH `/path/{ref}` — só os campos enviados. */
export function v2Patch<T>(transport: TransportV2, path: string, normalize?: (p: T) => T): V2WriteFn<T> {
  return (ref, payload) => transport.patch(`${path}/${refToV2Path(ref)}`, normalize ? normalize(payload) : payload)
}

/** DELETE `/path/{ref}` */
export function v2Delete(transport: TransportV2, path: string): V2DeleteFn {
  return (ref) => transport.delete(`${path}/${refToV2Path(ref)}`)
}

/** Ação sem referência no path (ex.: POST `/tasks/transfer`). */
export function v2Action<T>(transport: TransportV2, method: V2Method, path: string): V2CreateFn<T> {
  return (payload) => transport.request(method, path, payload)
}

export interface V2Link<TBody = never> {
  /** POST `/path/{ref}/{sub}/{subRef}` */
  add(ref: EntityRef, subRef: EntityRef, body?: TBody): Promise<V2Result>
  /** DELETE `/path/{ref}/{sub}/{subRef}` */
  remove(ref: EntityRef, subRef: EntityRef): Promise<V2Result>
  /** PUT `/path/{ref}/{sub}/{subRef}` */
  put(ref: EntityRef, subRef: EntityRef, body: TBody): Promise<V2Result>
  /** PATCH `/path/{ref}/{sub}/{subRef}` */
  patch(ref: EntityRef, subRef: EntityRef, body: TBody): Promise<V2Result>
}

/**
 * Vínculo `/path/{ref}/{sub}/{subRef}` — os módulos expõem só os verbos que a spec documenta.
 * Lança `UmovConfigError` se os refs forem de tipos diferentes (ver assertSameRefKind).
 */
export function v2Link<TBody = never>(transport: TransportV2, path: string, sub: string): V2Link<TBody> {
  const linkPath = (ref: EntityRef, subRef: EntityRef) => {
    assertSameRefKind(ref, subRef, `${path}/${sub}`)
    return `${path}/${refToV2Path(ref)}/${sub}/${refToV2Path(subRef)}`
  }
  // async para que a validação de refs rejeite a promise em vez de lançar síncrono
  return {
    add: async (ref, subRef, body) => transport.post(linkPath(ref, subRef), body),
    remove: async (ref, subRef) => transport.delete(linkPath(ref, subRef)),
    put: async (ref, subRef, body) => transport.put(linkPath(ref, subRef), body),
    patch: async (ref, subRef, body) => transport.patch(linkPath(ref, subRef), body),
  }
}
