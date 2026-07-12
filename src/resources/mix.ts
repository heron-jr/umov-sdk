import type { EntityRef, ListPage } from '../core/types'
import type { CustomEntitiesResource, CustomEntityEntriesResource } from './custom-entities'

export interface MixResource {
  /** Entries do cadastro Tipo de Mix (MIXTYPE). */
  types(): Promise<CustomEntityEntriesResource>
  /** Entries do cadastro Mix (MIX). */
  mixes(): Promise<CustomEntityEntriesResource>
  /** Entries do cadastro Itens do Mix (MIXITEM). */
  items(): Promise<CustomEntityEntriesResource>
  /** Itens de um mix específico (filtro pelo custom field mixItem_mix). */
  itemsOfMix(mixRecordId: number): Promise<ListPage>
}

/**
 * Mix de Produtos é implementado pela uMov.me como 3 custom entities auto-geradas
 * (structuralFunction=mix). Os IDs são específicos por ambiente — descobertos na
 * primeira chamada via GET customEntity.xml?structuralFunction=mix e cacheados.
 * Prefere endereçar por alternativeIdentifier (habilita o upsertBatch das entries).
 */
export function createMixResource(customEntities: CustomEntitiesResource): MixResource {
  interface Discovered {
    type: EntityRef
    mix: EntityRef
    item: EntityRef
  }
  let discovered: Promise<Discovered> | undefined

  function discover(): Promise<Discovered> {
    discovered ??= (async () => {
      try {
        const page = await customEntities.list({ structuralFunction: 'mix' })
        const details = await Promise.all(page.entries.map((e) => customEntities.get(e.id)))
        const byDesc = (patterns: RegExp[]) =>
          details.find((d) => patterns.some((p) => p.test(String(d.description ?? ''))))
        const type = byDesc([/tipo/i, /type/i])
        const item = byDesc([/ite?ns?\b/i, /item/i])
        const mix = details.find((d) => d !== type && d !== item)
        if (!type || !mix || !item) {
          throw new Error(
            `Mix não configurado neste ambiente: esperava 3 custom entities com structuralFunction=mix, ` +
              `encontrei ${details.length} (${details.map((d) => d.description).join(', ') || 'nenhuma'})`,
          )
        }
        // altId habilita upsertBatch nas entries; id é o fallback
        const ref = (d: (typeof details)[number]): EntityRef =>
          d.alternativeIdentifier ? { altId: String(d.alternativeIdentifier) } : d.id
        return { type: ref(type), mix: ref(mix), item: ref(item) }
      } catch (err) {
        // Falha (rede, 4xx/5xx ou mix ausente) não fica cacheada — a próxima chamada tenta de novo
        discovered = undefined
        throw err
      }
    })()
    return discovered
  }

  return {
    types: async () => customEntities.entries((await discover()).type),
    mixes: async () => customEntities.entries((await discover()).mix),
    items: async () => customEntities.entries((await discover()).item),
    itemsOfMix: async (mixRecordId) => {
      const { item } = await discover()
      return customEntities.entries(item).list({ raw: { mixItem_mix: String(mixRecordId) } })
    },
  }
}
