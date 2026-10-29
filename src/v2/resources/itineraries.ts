import type { EntityRef } from '../../core/types'
import { formatDate } from '../../util/datetime'
import { v2Action, v2Create, v2Delete, v2Link, v2Patch, v2Put, type V2CreateFn, type V2DeleteFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2DateInput, V2Ref, V2Result, V2ServiceLocalRelation } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `ActivityRelationDTO` — atividade por `activity` (ref) ou `activityId`. */
export interface V2ItineraryActivityRelation {
  activity?: V2Ref
  activityId?: number
}

/** `AgentRelationDTO` — agente por `agent` (ref) ou `agentId`. */
export interface V2ItineraryAgentRelation {
  agent?: V2Ref
  agentId?: number
}

/** `TeamRelationDTO` — equipe por `team` (ref) ou `teamId`. */
export interface V2ItineraryTeamRelation {
  team?: V2Ref
  teamId?: number
}

/** `Contrato referente à entidade Itinerary (Roteiro) no umov.me` — POST /itinerary, PUT|PATCH /itinerary/{ref}. */
export interface V2Itinerary {
  description?: string
  alternativeIdentifier?: string
  /** '1' sim · '0' não. */
  active?: string
  /** `yyyy-MM-dd`. */
  initialDate?: V2DateInput
  finalDate?: V2DateInput
  /** '0' rota normal · '1' agendamento de tarefas · '2' ciclo de trabalho (default '0'). */
  scheduleType?: '0' | '1' | '2'
  /** '0' alguns · '1' todos · '2' equipes. */
  agentRelationship?: string
  agents?: V2ItineraryAgentRelation[]
  teams?: V2ItineraryTeamRelation[]
  activities?: V2ItineraryActivityRelation[]
  /** Locais de atendimento (nome `locais` como na spec). */
  locais?: V2ServiceLocalRelation[]
  taskType?: V2Ref
  taskTypeId?: number
  activityOrigin?: string
  activityOriginList?: string[]
  /** '1' sim · '0' não. */
  createScheduleServiceLocal?: string
  displayOrder?: number
  /** 'N' sem exclusividade. */
  exclusive?: string
  recurrenceRepeatMode?: string
  /** '1' sim · '0' não. */
  repeatedLocations?: string
  /** 'A' todos · 'S' alguns. */
  researchRelationship?: string
  taskSchedule?: string
  teamExecution?: string
  /** 'N' não. */
  validateTaskInField?: string
  /** Dias da semana: '1' sim · '0' não. */
  monday?: string
  tuesday?: string
  wednesday?: string
  thursday?: string
  friday?: string
  saturday?: string
  sunday?: string
}

/** `DuplicateItinerary` — POST /itinerary/duplicate. `description` obrigatório; origem por `sourceId` OU `sourceAlternativeIdentifier`. */
export interface V2DuplicateItinerary {
  description: string
  alternativeIdentifier?: string
  sourceId?: number
  sourceAlternativeIdentifier?: string
}

const normalizeItinerary = (p: V2Itinerary): V2Itinerary => ({
  ...p,
  ...(p.initialDate !== undefined && { initialDate: formatDate(p.initialDate) }),
  ...(p.finalDate !== undefined && { finalDate: formatDate(p.finalDate) }),
})

// ---------- Recursos ----------

/** Vínculo `/itinerary/{ref}/{sub}/{ref}` — refs do mesmo tipo (id/id ou altId/altId). */
export interface V2ItineraryLink {
  add(itineraryRef: EntityRef, subRef: EntityRef): Promise<V2Result>
  remove(itineraryRef: EntityRef, subRef: EntityRef): Promise<V2Result>
}

export interface V2ItinerariesResource {
  create: V2CreateFn<V2Itinerary>
  put: V2WriteFn<V2Itinerary>
  patch: V2WriteFn<V2Itinerary>
  remove: V2DeleteFn
  duplicate: V2CreateFn<V2DuplicateItinerary>
  activities: V2ItineraryLink
  agents: V2ItineraryLink
  teams: V2ItineraryLink
  /** `/itinerary/{ref}/service-local/{ref}` — body opcional (ordem e janela de horário). */
  serviceLocals: {
    add(itineraryRef: EntityRef, localRef: EntityRef, body?: V2ServiceLocalRelation): Promise<V2Result>
    remove(itineraryRef: EntityRef, localRef: EntityRef): Promise<V2Result>
    patch(itineraryRef: EntityRef, localRef: EntityRef, body: V2ServiceLocalRelation): Promise<V2Result>
  }
}

export interface V2ItineraryResources {
  itineraries: V2ItinerariesResource
}

export function createItineraryResources(t: TransportV2): V2ItineraryResources {
  const activities = v2Link(t, 'itinerary', 'activity')
  const agents = v2Link(t, 'itinerary', 'agent')
  const teams = v2Link(t, 'itinerary', 'team')
  const serviceLocals = v2Link<V2ServiceLocalRelation>(t, 'itinerary', 'service-local')
  return {
    itineraries: {
      create: v2Create(t, 'itinerary', normalizeItinerary),
      put: v2Put(t, 'itinerary', normalizeItinerary),
      patch: v2Patch(t, 'itinerary', normalizeItinerary),
      remove: v2Delete(t, 'itinerary'),
      duplicate: v2Action(t, 'POST', 'itinerary/duplicate'),
      activities: { add: (a, b) => activities.add(a, b), remove: activities.remove },
      agents: { add: (a, b) => agents.add(a, b), remove: agents.remove },
      teams: { add: (a, b) => teams.add(a, b), remove: teams.remove },
      serviceLocals: { add: serviceLocals.add, remove: serviceLocals.remove, patch: serviceLocals.patch },
    },
  }
}
