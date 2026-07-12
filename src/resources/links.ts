import { defineBatch, defineDelete, defineResource, type BatchOptions, type ListOptions } from '../core/resource'
import { refToPath, type EntityRef, type ListPage, type ListStub } from '../core/types'
import type { Transport } from '../core/transport'
import type {
  AgentActivityCreate,
  ItineraryActivityCreate,
  ItineraryAgentCreate,
  ItineraryServiceLocalCreate,
  ScheduleItemCreate,
  SectionSubGroupCreate,
  ServiceLocalActivityCreate,
} from './types'

export interface LinkFilters {
  raw?: Record<string, string>
  [key: string]: unknown
}

/** Recurso de vínculo: leitura + upsert em lote atômico (+ delete quando a API documenta). */
export interface LinkResource<TCreate> {
  list(filters?: LinkFilters, opts?: ListOptions): Promise<ListPage>
  get(ref: EntityRef): Promise<Record<string, unknown>>
  /** Upsert por alternativeIdentifier — ATÔMICO: qualquer erro aborta o lote inteiro. */
  upsertBatch(items: TCreate[], opts?: BatchOptions): Promise<ListStub[]>
}

export interface DeletableLinkResource<TCreate> extends LinkResource<TCreate> {
  /** DELETE por id interno (a API não documenta DELETE por altId avulso — use deleteByPair). */
  delete(ref: number | { id: number }): Promise<void>
}

interface LinkConfig {
  path: string
  batchPath: string
  max?: number
  deletable?: boolean
}

function defineLink<TCreate>(transport: Transport, cfg: LinkConfig) {
  const base = defineResource<Record<string, unknown>, never, never, LinkFilters>(transport, { path: cfg.path })
  const resource: LinkResource<TCreate> & { delete?: (ref: number | { id: number }) => Promise<void> } = {
    list: base.list,
    get: base.get,
    upsertBatch: defineBatch<TCreate>(transport, {
      path: cfg.batchPath,
      wrapper: cfg.batchPath,
      itemRoot: cfg.path,
      max: cfg.max ?? 100,
    }),
  }
  if (cfg.deletable) resource.delete = defineDelete(transport, cfg.path)
  return resource
}

export interface ScheduleItemsResource extends DeletableLinkResource<ScheduleItemCreate> {
  /** DELETE por par de alternativeIdentifiers (schedule + item). */
  deleteByPair(pair: { scheduleAltId: string; itemAltId: string }): Promise<void>
}

/** sectionSubGroup só documenta DELETE em forma de PAR — não há rota de delete por id avulso. */
export interface SectionSubGroupsResource extends LinkResource<SectionSubGroupCreate> {
  /** DELETE por par (ids internos ou altIds, intercambiáveis nas mesmas posições). */
  deleteByPair(pair: { subGroup: EntityRef; section: EntityRef }): Promise<void>
}

export interface ItineraryLinkResource<TCreate> extends DeletableLinkResource<TCreate> {
  /** DELETE por par de alternativeIdentifiers (itinerary + entidade vinculada). */
  deleteByPair(pair: { itineraryAltId: string; linkedAltId: string }): Promise<void>
}

function pairSegment(ref: EntityRef): string {
  // Nos paths de par, id e altId entram CRUS na mesma posição (sem o prefixo alternativeIdentifier/)
  if (typeof ref === 'number') return String(ref)
  if (typeof ref === 'string') return encodeURIComponent(ref)
  if ('id' in ref) return String(ref.id)
  return encodeURIComponent(ref.altId)
}

export function createLinkResources(transport: Transport) {
  const scheduleItems: ScheduleItemsResource = {
    ...(defineLink<ScheduleItemCreate>(transport, {
      path: 'scheduleItem',
      batchPath: 'scheduleItems',
      deletable: true,
    }) as DeletableLinkResource<ScheduleItemCreate>),
    async deleteByPair({ scheduleAltId, itemAltId }) {
      await transport.delete(
        `scheduleItem/schedule/${encodeURIComponent(scheduleAltId)}/item/${encodeURIComponent(itemAltId)}.xml`,
      )
    },
  }

  const sectionSubGroups: SectionSubGroupsResource = {
    ...(defineLink<SectionSubGroupCreate>(transport, {
      path: 'sectionSubGroup',
      batchPath: 'sectionSubGroups',
    }) as LinkResource<SectionSubGroupCreate>),
    async deleteByPair({ subGroup, section }) {
      await transport.delete(`sectionSubGroup/${pairSegment(subGroup)}/${pairSegment(section)}.xml`)
    },
  }

  function itineraryLink<TCreate>(path: string, batchPath: string, linkedSegment: string): ItineraryLinkResource<TCreate> {
    return {
      ...(defineLink<TCreate>(transport, { path, batchPath, deletable: true }) as DeletableLinkResource<TCreate>),
      async deleteByPair({ itineraryAltId, linkedAltId }) {
        await transport.delete(
          `${path}/itinerary/${encodeURIComponent(itineraryAltId)}/${linkedSegment}/${encodeURIComponent(linkedAltId)}.xml`,
        )
      },
    }
  }

  return {
    agentActivities: defineLink<AgentActivityCreate>(transport, {
      path: 'agentActivity',
      batchPath: 'agentActivities',
    }) as LinkResource<AgentActivityCreate>,
    scheduleItems,
    sectionSubGroups,
    serviceLocalActivities: defineLink<ServiceLocalActivityCreate>(transport, {
      path: 'serviceLocalActivity',
      batchPath: 'serviceLocalActivities',
      deletable: true,
    }) as DeletableLinkResource<ServiceLocalActivityCreate>,
    itineraryActivities: itineraryLink<ItineraryActivityCreate>('itineraryActivity', 'itineraryActivities', 'activity'),
    itineraryAgents: itineraryLink<ItineraryAgentCreate>('itineraryAgent', 'itineraryAgents', 'agent'),
    itineraryServiceLocals: itineraryLink<ItineraryServiceLocalCreate>(
      'itineraryServiceLocal',
      'itineraryServiceLocals',
      'serviceLocal',
    ),
  }
}
