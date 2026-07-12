/**
 * Referência a um registro da uMov.me.
 * - `number` ou `{ id }` → id interno → `/recurso/{id}.xml`
 * - `string` ou `{ altId }` → alternativeIdentifier → `/recurso/alternativeIdentifier/{altId}.xml`
 */
export type EntityRef = number | string | { id: number } | { altId: string }

export function refToPath(ref: EntityRef): string {
  if (typeof ref === 'number') return String(ref)
  if (typeof ref === 'string') return `alternativeIdentifier/${encodeURIComponent(ref)}`
  if ('id' in ref) return String(ref.id)
  return `alternativeIdentifier/${encodeURIComponent(ref.altId)}`
}

/** Referência a entidade relacionada dentro de um payload (ex.: agent de um schedule). */
export type RelationRef = { id: number } | { alternativeIdentifier: string }

export interface ListStub {
  id: number
  link: string
}

export interface ListPage {
  size: number
  entries: ListStub[]
}
