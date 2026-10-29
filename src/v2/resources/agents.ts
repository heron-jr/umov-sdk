import type { EntityRef } from '../../core/types'
import { formatDateTime } from '../../util/datetime'
import { idOf, refToV2Path, v2Create, v2Delete, v2Link, v2Patch, v2Put, type V2CreateFn, type V2DeleteFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2AgentAddress, V2CustomField, V2IdRef, V2Image, V2PhoneContact, V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `Data object de dados do agente` — POST /agents, PUT|PATCH /agents/{ref}. */
export interface V2Agent {
  name?: string
  login?: string
  /** Só na criação. */
  password?: string
  alternativeIdentifier?: string
  active?: boolean
  email?: string
  observation?: string
  agentType?: V2Ref
  /** Perfil de acesso — obrigatório se `webUser: true` (`field_required:accessRole`). */
  accessRole?: V2Ref
  idiom?: V2Ref
  weeklyWorkday?: V2Ref
  activities?: V2Ref[]
  address?: V2AgentAddress
  phone?: V2PhoneContact
  cellphone?: V2PhoneContact
  image?: V2Image
  customFields?: V2CustomField[]
  capacity?: { capacity1?: number; capacity2?: number }
  webUser?: boolean
  mobileUser?: boolean
  agentAccessType?: 'ALL' | 'ONLY_OAUTH' | 'ONLY_PASSWORD'
  availableToWork?: boolean
  changePassword?: boolean
  memorizePasswordOnMobile?: boolean
  lockLoginOnIMEIChange?: boolean
  ignoreTeamFilter?: boolean
  shouldChangeAlternativeIdentifier?: boolean
  taskExecutionPriority?: 'TRUE' | 'FALSE'
  language?: 'en_US' | 'es_ES' | 'pt_BR'
  timezone?: string
  timezoneLocation?: string
  geoLocationTimezone?: string
  /** '0' letras e números · '1' só letras · '2' só números. */
  passwordPolicy?: string
  /** '0' não valida · '1' responsável do local · '2' rota · '3' equipe responsável. */
  validateAgentPortfolio?: string
  providerGeneral?: 'GOOGLE' | 'NATIVE'
  providerGeneralPrecision?: 'LESS_PRECISION' | 'MORE_PRECISION'
  providerTracking?: 'GOOGLE' | 'NATIVE'
  providerTrackingPrecision?: 'LESS_PRECISION' | 'MORE_PRECISION'
  gpsDistanceInMetersCapture?: number
  gpsTimeInMinutesCapture?: number
  currentStatusWorkJourney?: number
}

/** `Contrato referente ao tipo de agente` — description obrigatório. */
export interface V2AgentType {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
}

/** `Data object de dados da ausência do agente` — POST /absence. */
export interface V2Absence {
  alternativeIdentifier?: string
  /** '0' ignorar agenda · '1' transferir para `destinationAgent` · '2' não permitir login. */
  action?: string
  active?: boolean
  description?: string
  originAgent?: V2Ref
  /** Obrigatório quando `action` = '1' (`field_required:destinationAgent`). */
  destinationAgent?: V2Ref
  /**
   * `yyyy-MM-dd HH:mm:ss` — ISO com `T` é REJEITADO pela API (`field_required`/`bad body message`,
   * validado em 2026-10-29). `Date` é formatado pelo SDK no fuso local.
   */
  initialDateTime?: Date | string
  finalDateTime?: Date | string
}

/** `Data object de dados da jornada de trabalho` — /workJourney e /workDayJourney. */
export interface V2WorkJourney {
  id?: number
  alternativeIdentifier?: string
  description?: string
  active?: boolean
  /** ATENÇÃO: qualquer valor devolveu `Data integrity violation` na API real (2026-10-29); omita até a uMov corrigir. */
  taskCreationValidation?: 'DONT_VALIDATE' | 'VALIDATE_AND_ASK_CONFIRMATION' | 'VALIDATE_AND_BLOCK'
}

export type V2Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

/** `PasswordPolicyRequest` — todos obrigatórios. */
export interface V2PasswordPolicy {
  minimumCharacters: number
  minimumLowerCharacters: number
  minimumUpperCharacters: number
  minimumNumericCharacters: number
  minimumSpecialCharacters: number
  passwordsToKeep: number
  preventPasswordReuse: boolean
}

// ---------- Recursos ----------

export interface V2AgentsResource {
  create: V2CreateFn<V2Agent>
  put: V2WriteFn<V2Agent>
  patch: V2WriteFn<V2Agent>
  /** `/agents/{ref}/activity/{ref}` — refs do mesmo tipo (id/id ou altId/altId). */
  activities: {
    add(agentRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
    remove(agentRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
  }
}

export interface V2AgentTypesResource {
  create: V2CreateFn<V2AgentType>
  put: V2WriteFn<V2AgentType>
  patch: V2WriteFn<V2AgentType>
  remove: V2DeleteFn
}

export interface V2AbsencesResource {
  create: V2CreateFn<V2Absence>
  put: V2WriteFn<V2Absence>
  patch: V2WriteFn<V2Absence>
}

export interface V2WorkJourneysResource {
  create: V2CreateFn<V2WorkJourney>
  patch: V2WriteFn<V2WorkJourney>
  remove: V2DeleteFn
  /** Dias da jornada — a spec só expõe por altId da jornada. */
  workDays: {
    create(journeyAltId: string, body: V2WorkJourney): Promise<V2Result>
    put(journeyAltId: string, body: V2WorkJourney): Promise<V2Result>
    remove(journeyAltId: string, day: V2Weekday): Promise<V2Result>
  }
}

export interface V2WorkDayJourneysResource {
  create: V2CreateFn<V2WorkJourney>
  patch(ref: V2IdRef, body: V2WorkJourney): Promise<V2Result>
  remove(ref: V2IdRef): Promise<V2Result>
}

export interface V2PasswordPoliciesResource {
  create: V2CreateFn<V2PasswordPolicy>
  put(ref: V2IdRef, body: V2PasswordPolicy): Promise<V2Result>
  remove(ref: V2IdRef): Promise<V2Result>
}

export interface V2AgentResources {
  agents: V2AgentsResource
  agentTypes: V2AgentTypesResource
  absences: V2AbsencesResource
  workJourneys: V2WorkJourneysResource
  workDayJourneys: V2WorkDayJourneysResource
  passwordPolicies: V2PasswordPoliciesResource
}

function normalizeAbsence(p: V2Absence): V2Absence {
  const out = { ...p }
  if (p.initialDateTime instanceof Date) out.initialDateTime = formatDateTime(p.initialDateTime)
  if (p.finalDateTime instanceof Date) out.finalDateTime = formatDateTime(p.finalDateTime)
  return out
}

export function createAgentResources(t: TransportV2): V2AgentResources {
  const agentActivities = v2Link(t, 'agents', 'activity')
  const workDays = (altId: string) => `workJourney/${refToV2Path({ altId })}/work-days`
  return {
    agents: {
      create: v2Create(t, 'agents'),
      put: v2Put(t, 'agents'),
      patch: v2Patch(t, 'agents'),
      activities: { add: (a, b) => agentActivities.add(a, b), remove: agentActivities.remove },
    },
    agentTypes: {
      create: v2Create(t, 'agentType'),
      put: v2Put(t, 'agentType'),
      patch: v2Patch(t, 'agentType'),
      remove: v2Delete(t, 'agentType'),
    },
    absences: {
      create: v2Create(t, 'absence', normalizeAbsence),
      put: v2Put(t, 'absence', normalizeAbsence),
      patch: v2Patch(t, 'absence', normalizeAbsence),
    },
    workJourneys: {
      create: v2Create(t, 'workJourney'),
      patch: v2Patch(t, 'workJourney'),
      remove: v2Delete(t, 'workJourney'),
      workDays: {
        create: (altId, body) => t.post(workDays(altId), body),
        put: (altId, body) => t.put(workDays(altId), body),
        remove: (altId, day) => t.delete(`${workDays(altId)}/${day}`),
      },
    },
    workDayJourneys: {
      create: v2Create(t, 'workDayJourney'),
      patch: (ref, body) => t.patch(`workDayJourney/${idOf(ref)}`, body),
      remove: (ref) => t.delete(`workDayJourney/${idOf(ref)}`),
    },
    passwordPolicies: {
      create: v2Create(t, 'password-policies'),
      put: (ref, body) => t.put(`password-policies/${idOf(ref)}`, body),
      remove: (ref) => t.delete(`password-policies/${idOf(ref)}`),
    },
  }
}
