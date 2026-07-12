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
  scheduleType?: { id?: number; description?: string; alternativeIdentifier?: string }
  activitiesOrigin?: string
  /** Atividades vinculadas — presentes só na resposta de detalhe (doc uMov.me). */
  activityRelationship?: unknown
  customFields?: unknown
  [key: string]: unknown
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

// ---------- Cadastros simples (agentType, teamType, group, itemCategory, serviceLocalType, ...) ----------
export interface SimpleEntity {
  id: number
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  [key: string]: unknown
}
export interface SimpleEntityCreate {
  description: string
  alternativeIdentifier?: string
  active?: boolean
}
export type SimpleEntityUpdate = Partial<SimpleEntityCreate>
export interface SimpleEntityFilters {
  description?: string
  active?: boolean
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- SubGroup ----------
export interface SubGroupCreate extends SimpleEntityCreate {
  group?: RelationRef
}
export type SubGroupUpdate = Partial<SubGroupCreate>

// ---------- Item ----------
export interface ItemCreate {
  description: string
  subGroup: RelationRef
  alternativeIdentifier?: string
  active?: boolean
  itemCategory?: RelationRef
  customFields?: CustomFieldValues
  image?: { imageUrlImport: string }
}
export type ItemUpdate = Partial<ItemCreate>
export interface ItemFilters {
  description?: string
  active?: boolean
  subGroup?: number
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- AditionalInfoItem (grafia da própria API) ----------
export interface AdditionalInfoItemCreate {
  featuredInfo: string
  active?: boolean
  item?: RelationRef
  section?: RelationRef
  serviceLocal?: RelationRef
}
export type AdditionalInfoItemUpdate = Partial<AdditionalInfoItemCreate>

// ---------- SectionItem ----------
export interface SectionItemCreate {
  section: RelationRef
  item: RelationRef
  active?: boolean
  order?: number
  mandatory?: boolean
}
export type SectionItemUpdate = Partial<SectionItemCreate>
export interface SectionItemFilters {
  active?: boolean
  section?: number
  item?: number
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- Team ----------
export interface Team {
  id: number
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  teamType?: { id?: number; description?: string }
  agentRelationship?: unknown
  [key: string]: unknown
}
export interface TeamCreate {
  description: string
  teamType: RelationRef
  alternativeIdentifier?: string
  active?: boolean
  /** ATENÇÃO: em update, este bloco SUBSTITUI todos os membros existentes. */
  agentRelationship?: { agent: Array<{ id: number; responsible?: boolean }> }
}
export type TeamUpdate = Partial<TeamCreate>

// ---------- Itinerary ----------
export interface Itinerary {
  id: number
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  origin?: number
  agentRelation?: number
  displayOrder?: number
  exclusive?: boolean
  itineraryDefault?: boolean
  [key: string]: unknown
}
export interface ItineraryCreate {
  description: string
  alternativeIdentifier?: string
  active?: boolean
  origin?: number
  agentRelation?: number
  displayOrder?: number
  exclusive?: boolean
  itineraryDefault?: boolean
}
export type ItineraryUpdate = Partial<ItineraryCreate>

// ---------- Vínculos ----------
export interface AgentActivityCreate {
  agent: { alternativeIdentifier: string }
  activity: { alternativeIdentifier: string }
}
export interface ScheduleItemCreate {
  schedule: RelationRef
  item: RelationRef
  customFields?: CustomFieldValues
}
export interface SectionSubGroupCreate {
  subGroup: RelationRef
  section: RelationRef
}
export interface Weekdays {
  monday?: boolean
  tuesday?: boolean
  wednesday?: boolean
  thursday?: boolean
  friday?: boolean
  saturday?: boolean
  sunday?: boolean
}
export interface ServiceLocalActivityCreate {
  serviceLocal: RelationRef
  activity: RelationRef
  weekdays?: Weekdays
  customFields?: CustomFieldValues
}
export interface ItineraryActivityCreate {
  itinerary: RelationRef
  activity: RelationRef
  /** Grafia com um 'm' só é da própria API. */
  comunicationType?: number
}
export interface ItineraryAgentCreate {
  itinerary: RelationRef
  agent: RelationRef
}
export interface ItineraryServiceLocalCreate {
  itinerary: RelationRef
  serviceLocal: RelationRef
  /** Ordem no roteiro e na exibição do mobile — obrigatório na API. */
  treatmentOrder: number
}

// ---------- CustomEntity ----------
export interface CustomEntity {
  id: number
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  structuralFunction?: string
  [key: string]: unknown
}
export interface CustomEntityFilters {
  description?: string
  structuralFunction?: string
  raw?: Record<string, string>
  [key: string]: unknown
}
export interface CustomEntityEntryCreate {
  description: string
  customFields: CustomFieldValues
  alternativeIdentifier?: string
  active?: boolean
}
export type CustomEntityEntryUpdate = Partial<CustomEntityEntryCreate>

// ---------- ScheduleRouting ----------
export interface ScheduleRoutingRequest {
  origin: { agent: RelationRef; transportMode?: 0 | 1 | 2 } | { geoCoordinate: string; transportMode?: 0 | 1 | 2 }
  schedules: Array<{ schedule: RelationRef; dependencies?: RelationRef[] }>
  /** default true — se o roteirizador deve ordenar as tarefas. */
  route?: boolean
  /** default true — atualiza prioridade/status ('Em Preparação' → 'Pendente de Envio'). */
  updateSchedules?: boolean
  startTime?: Date | string
  /** default false — usa Google Maps para estimar tempo/distância. */
  estimate?: boolean
}
