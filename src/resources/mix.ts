import type { ListPage } from '../core/types'
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
 */
export function createMixResource(customEntities: CustomEntitiesResource): MixResource {
  let discovered: Promise<{ typeId: number; mixId: number; itemId: number }> | undefined

  function discover() {
    discovered ??= (async () => {
      const page = await customEntities.list({ structuralFunction: 'mix' })
      const details = await Promise.all(page.entries.map((e) => customEntities.get(e.id)))
      const byDesc = (patterns: RegExp[]) =>
        details.find((d) => patterns.some((p) => p.test(String(d.description ?? ''))))?.id
      const typeId = byDesc([/tipo/i, /type/i])
      const itemId = byDesc([/ite?ns?/i, /item/i])
      const mixId = details.find((d) => d.id !== typeId && d.id !== itemId)?.id
      if (!typeId || !mixId || !itemId) {
        discovered = undefined // permite nova tentativa
        throw new Error(
          `Mix não configurado neste ambiente: esperava 3 custom entities com structuralFunction=mix, ` +
            `encontrei ${details.length} (${details.map((d) => d.description).join(', ') || 'nenhuma'})`,
        )
      }
      return { typeId, mixId, itemId }
    })()
    return discovered
  }

  return {
    types: async () => customEntities.entries((await discover()).typeId),
    mixes: async () => customEntities.entries((await discover()).mixId),
    items: async () => customEntities.entries((await discover()).itemId),
    itemsOfMix: async (mixRecordId) => {
      const { itemId } = await discover()
      return customEntities.entries(itemId).list({ raw: { mixItem_mix: String(mixRecordId) } })
    },
  }
}
