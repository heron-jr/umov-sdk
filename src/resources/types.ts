import type { RelationRef } from '../core/types'

/** Valores de custom fields: chave = alternativeIdentifier (ou nome) do campo. Arrays viram pipe. */
export type CustomFieldValues = Record<string, string | string[]>

// ---------- Agent ----------
export interface Agent {
  id: number
  name: string
  login?: string
  active?: boolean
  alternativeIdentifier?: string
  email?: string
  observation?: string
  agentType?: { id?: number; description?: string; alternativeIdentifier?: string }
}
export interface AgentCreate {
  name: string
  login: string
  password: string
  agentType: RelationRef
  alternativeIdentifier?: string
  active?: boolean
  email?: string
  observation?: string
  customFields?: CustomFieldValues
  image?: { imageUrlImport: string }
}
export type AgentUpdate = Partial<AgentCreate>
export interface AgentFilters {
  name?: string
  active?: boolean
  'agentType.description'?: string
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- ServiceLocal ----------
export interface ServiceLocal {
  id: number
  description?: string
  corporateName?: string
  alternativeIdentifier?: string
  active?: boolean
  country?: string
  state?: string
  city?: string
  cityNeighborhood?: string
  streetType?: string
  street?: string
  streetNumber?: string
  streetComplement?: string
  zipCode?: string
  email?: string
  observation?: string
  geoCoordinate?: string
  serviceLocalType?: { id?: number; description?: string; alternativeIdentifier?: string }
}
export interface ServiceLocalCreate {
  description: string
  corporateName?: string
  alternativeIdentifier?: string
  active?: boolean
  country?: string
  state?: string
  city?: string
  cityNeighborhood?: string
  streetType?: string
  street?: string
  streetNumber?: string
  streetComplement?: string
  zipCode?: string
  email?: string
  observation?: string
  /** Se omitida, a uMov.me deriva do endereço (fica vazia se endereço inválido). */
  geoCoordinate?: string
  serviceLocalType?: RelationRef
  customFields?: CustomFieldValues
}
export type ServiceLocalUpdate = Partial<ServiceLocalCreate>
export interface ServiceLocalFilters {
  country?: string
  active?: boolean
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- Schedule ----------
/** Situações documentadas: 30=pendente de envio, 40=em campo, 50=executada, 70=cancelada. */
export type ScheduleSituation = 30 | 40 | 50 | 70
export interface Schedule {
  id: number
  date?: string
  hour?: string
  observation?: string
  alternativeIdentifier?: string
  situation?: { id?: number; description?: string }
  agent?: { id?: number; name?: string; alternativeIdentifier?: string }
  serviceLocal?: { id?: number; description?: string; alternativeIdentifier?: string }
  activitiesOrigin?: string
}
export interface ScheduleCreate {
  agent: RelationRef
  serviceLocal: RelationRef
  date: Date | string
  hour: string
  observation?: string
  alternativeIdentifier?: string
  scheduleType?: RelationRef
  activitiesOrigin?: number
  activityRelationship?: { activity: RelationRef | RelationRef[] }
  customFields?: CustomFieldValues
}
export type ScheduleUpdate = Partial<ScheduleCreate> & { situation?: { id: ScheduleSituation } }
export interface ScheduleFilters {
  serviceLocal?: number
  'serviceLocal.alternativeIdentifier'?: string
  agent?: number
  'agent.active'?: boolean
  situation?: number
  'situation.description'?: string
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- Activity / Section / SectionField (read-only) ----------
export interface Activity {
  id: number
  description?: string
  alternativeIdentifier?: string
  active?: boolean
}
export interface ActivityFilters {
  description?: string
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}
export interface Section {
  id: number
  description?: string
  order?: string
  mandatory?: boolean
  active?: boolean
}
export interface SectionFilters {
  'activity.description'?: string
  raw?: Record<string, string>
  [key: string]: unknown
}
export interface SectionField {
  id: number
  description?: string
  /** Código de letra do tipo do campo (ex.: I, L) — mapa não documentado pela uMov.me. */
  type?: string
  active?: boolean
  alternativeIdentifier?: string
}
export interface SectionFieldFilters {
  description?: string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- ActivityHistory ----------
export interface ActivityHistory {
  id: number
  status?: string
  startTimeOnSystem?: string
  finishTimeOnSystem?: string
  endTimeSync?: string
  executionExportStatus?: string
  exportFileName?: string
  statusApproval?: string
  activity?: { id?: number; description?: string; alternativeIdentifier?: string }
  schedule?: { id?: number; alternativeIdentifier?: string }
}
export interface ActivityHistoryFilters {
  schedule?: number
  'schedule.alternativeIdentifier'?: string
  initialStartTimeOnSystem?: Date | string
  endStartTimeOnSystem?: Date | string
  initialFinishTimeOnSystem?: Date | string
  endFinishTimeOnSystem?: Date | string
  'activity.captureGPS'?: boolean
  raw?: Record<string, string>
  [key: string]: unknown
}
/** Árvore completa activity>sections>items>fields>geo — estrutura varia por atividade. */
export interface ActivityHistoryHierarchical extends ActivityHistory {
  [key: string]: unknown
}

// ---------- GeoCoordinate ----------
export interface GeoCoordinate {
  id: number
  latitude?: string
  longitude?: string
  date?: string
  type?: string
  agent?: { id?: number; name?: string }
}
export interface GeoCoordinateFilters {
  date?: Date | string
  agent?: number
  initialDate?: Date | string
  finalDate?: Date | string
  initialDateTime?: Date | string
  finalDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- CustomField ----------
export interface CustomFieldEntry {
  id?: number
  alternativeIdentifier?: string
  description?: string
  active?: boolean
  value?: string
}
