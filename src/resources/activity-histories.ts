import { defineResource } from '../core/resource'
import { parseDetailResponse, parseWriteResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { refToPath, type EntityRef, type ListPage, type ListStub } from '../core/types'
import type { IterateOptions, ListOptions } from '../core/resource'
import type { Transport } from '../core/transport'
import type { ActivityHistory, ActivityHistoryFilters, ActivityHistoryHierarchical } from './types'

export interface ActivityHistoryCreate {
  activity: { id: number } | { alternativeIdentifier: string }
  [key: string]: unknown
}

export interface ActivityHistoriesResource {
  /** Sem filtro de data a API retorna só os últimos 7 dias. */
  list(filters?: ActivityHistoryFilters, opts?: ListOptions): Promise<ListPage>
  iterate(filters?: ActivityHistoryFilters, opts?: IterateOptions & { hydrate: true }): AsyncGenerator<ActivityHistory>
  iterate(filters?: ActivityHistoryFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  get(ref: EntityRef): Promise<ActivityHistory>
  /** Árvore completa activity>sections>items>fields>geo — a base para gerar laudos. */
  hierarchical(id: number): Promise<ActivityHistoryHierarchical>
  /** Cria história via API (schedule precisa estar pendente de envio ou em campo; pula validações do mobile). */
  createForSchedule(scheduleRef: EntityRef, payload: ActivityHistoryCreate): Promise<{ id: number }>
  /** 3 = aprovado, 4 = rejeitado. Só funciona enquanto pendente de aprovação. */
  setApproval(id: number, status: 3 | 4): Promise<void>
  setExportStatus(id: number, opts: { executionExportStatus: string; exportFileName?: string }): Promise<void>
}

export function createActivityHistoriesResource(transport: Transport): ActivityHistoriesResource {
  const base = defineResource<ActivityHistory, never, Record<string, unknown>, ActivityHistoryFilters>(transport, {
    path: 'activityHistory',
  })
  return {
    list: base.list,
    iterate: base.iterate,
    get: base.get,
    async hierarchical(id) {
      const xml = await transport.get(`activityHistoryHierarchical/${id}.xml`)
      return parseDetailResponse<ActivityHistoryHierarchical>(xml, 'activityHistory')
    },
    async createForSchedule(scheduleRef, payload) {
      const xml = serializeEntity('activityHistory', payload as Record<string, never>)
      const res = parseWriteResponse(
        await transport.post(`schedule/${refToPath(scheduleRef)}/activityHistory.xml`, xml),
      )
      return { id: res.id }
    },
    setApproval: (id, status) => base.update(id, { statusApproval: status }),
    setExportStatus: (id, opts) => base.update(id, { ...opts }),
  }
}
