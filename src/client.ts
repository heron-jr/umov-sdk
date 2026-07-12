import { Transport, type TransportOptions } from './core/transport'
import { defineBatch, defineResource, type BatchOptions } from './core/resource'
import { createSchedulesResource, type SchedulesResource } from './resources/schedules'
import {
  createActivityHistoriesResource,
  type ActivityHistoriesResource,
} from './resources/activity-histories'
import { createCustomFieldsAccessor, type CustomFieldsAccessor } from './resources/custom-fields'
import { createTeamsResource, type TeamsResource } from './resources/teams'
import { createLinkResources } from './resources/links'
import { createMessagingResources } from './resources/messaging'
import { createAuditingResource, type AuditingResource } from './resources/auditing'
import { createCustomEntitiesResource, type CustomEntitiesResource } from './resources/custom-entities'
import { createMixResource, type MixResource } from './resources/mix'
import { createFileResources } from './resources/files'
import type { ListStub } from './core/types'
import type {
  Activity,
  ActivityFilters,
  AdditionalInfoItemCreate,
  AdditionalInfoItemUpdate,
  Agent,
  AgentCreate,
  AgentFilters,
  AgentUpdate,
  GeoCoordinate,
  GeoCoordinateFilters,
  Itinerary,
  ItineraryCreate,
  ItineraryUpdate,
  ItemCreate,
  ItemFilters,
  ItemUpdate,
  Section,
  SectionField,
  SectionFieldFilters,
  SectionFilters,
  SectionItemCreate,
  SectionItemFilters,
  SectionItemUpdate,
  ServiceLocal,
  ServiceLocalCreate,
  ServiceLocalFilters,
  ServiceLocalUpdate,
  SimpleEntity,
  SimpleEntityCreate,
  SimpleEntityFilters,
  SimpleEntityUpdate,
  SubGroupCreate,
  SubGroupUpdate,
} from './resources/types'

import { getToken, type TokenCredentials } from './core/token'

export type UmovClientOptions = TransportOptions

export type UmovClientCredentialsOptions = TokenCredentials & Omit<TransportOptions, 'apiKey'>

/** Remove create/update da superfície pública de recursos somente leitura. */
function readOnly<T extends { create: unknown; update: unknown }>(resource: T): Omit<T, 'create' | 'update'> {
  const { create: _c, update: _u, ...rest } = resource
  return rest
}

export class UmovClient {
  /**
   * Autentica com login/senha/domínio via POST /token.xml e retorna um cliente pronto.
   * ATENÇÃO: regenerar o token no Center invalida integrações que usam o token recuperado.
   */
  static async fromCredentials(options: UmovClientCredentialsOptions): Promise<UmovClient> {
    const { login, password, domain, ...transportOptions } = options
    const apiKey = await getToken({
      login,
      password,
      domain,
      baseUrl: transportOptions.baseUrl,
      fetch: transportOptions.fetch,
    })
    return new UmovClient({ ...transportOptions, apiKey })
  }

  // Pessoas
  readonly agents
  readonly agentTypes
  readonly teams: TeamsResource
  readonly teamTypes
  // Formulários (read-only por limitação da API)
  readonly activities
  readonly sections
  readonly sectionFields
  readonly mathExpressions
  readonly logicalExpressions
  // Itens
  readonly items
  readonly groups
  readonly subGroups
  readonly itemCategories
  readonly additionalInfoItems
  readonly sectionItems
  // Locais
  readonly serviceLocals
  readonly serviceLocalTypes
  readonly serviceLocalClassifications
  readonly local3Dimensions
  // Tarefas e execução
  readonly schedules: SchedulesResource
  readonly activityHistories: ActivityHistoriesResource
  readonly geoCoordinates
  readonly auditing: AuditingResource
  // Rotas
  readonly itineraries
  // Vínculos
  readonly agentActivities
  readonly scheduleItems
  readonly sectionSubGroups
  readonly serviceLocalActivities
  readonly itineraryActivities
  readonly itineraryAgents
  readonly itineraryServiceLocals
  // Customizáveis
  readonly customFields: CustomFieldsAccessor
  readonly customEntities: CustomEntitiesResource
  readonly mix: MixResource
  // Mensageria
  readonly messages
  readonly pushNotifications
  readonly sms
  // Arquivos
  readonly importFiles
  readonly importLayouts
  readonly exportLayouts

  constructor(options: UmovClientOptions) {
    if (!options.apiKey) throw new Error('UmovClient: apiKey é obrigatória')
    const transport = new Transport(options)

    const simple = (path: string) =>
      defineResource<SimpleEntity, SimpleEntityCreate, SimpleEntityUpdate, SimpleEntityFilters>(transport, { path })

    // Pessoas
    this.agents = defineResource<Agent, AgentCreate, AgentUpdate, AgentFilters>(transport, { path: 'agent' })
    this.agentTypes = simple('agentType')
    this.teams = createTeamsResource(transport)
    this.teamTypes = simple('teamType')

    // Formulários — read-only por limitação da API (spec §2)
    this.activities = readOnly(defineResource<Activity, never, never, ActivityFilters>(transport, { path: 'activity' }))
    this.sections = readOnly(defineResource<Section, never, never, SectionFilters>(transport, { path: 'section' }))
    this.sectionFields = readOnly(
      defineResource<SectionField, never, never, SectionFieldFilters>(transport, { path: 'sectionField' }),
    )
    this.mathExpressions = readOnly(
      defineResource<SimpleEntity, never, never, SimpleEntityFilters>(transport, { path: 'mathExpression' }),
    )
    this.logicalExpressions = readOnly(
      defineResource<SimpleEntity, never, never, SimpleEntityFilters>(transport, { path: 'logicalExpression' }),
    )

    // Itens
    const itemsBase = defineResource<SimpleEntity, ItemCreate, ItemUpdate, ItemFilters>(transport, { path: 'item' })
    this.items = {
      ...itemsBase,
      upsertBatch: defineBatch<ItemCreate>(transport, { path: 'items', wrapper: 'items', itemRoot: 'item', max: 100 }),
    }
    this.groups = simple('group')
    this.subGroups = defineResource<SimpleEntity, SubGroupCreate, SubGroupUpdate, SimpleEntityFilters>(transport, {
      path: 'subGroup',
    })
    this.itemCategories = simple('itemCategory')
    // Grafia 'aditional' é da própria API
    this.additionalInfoItems = defineResource<
      SimpleEntity,
      AdditionalInfoItemCreate,
      AdditionalInfoItemUpdate,
      SimpleEntityFilters
    >(transport, { path: 'aditionalInfoItem' })
    this.sectionItems = defineResource<SimpleEntity, SectionItemCreate, SectionItemUpdate, SectionItemFilters>(
      transport,
      { path: 'sectionItem' },
    )

    // Locais
    const serviceLocalsBase = defineResource<ServiceLocal, ServiceLocalCreate, ServiceLocalUpdate, ServiceLocalFilters>(
      transport,
      { path: 'serviceLocal' },
    )
    this.serviceLocals = {
      ...serviceLocalsBase,
      upsertBatch: defineBatch<ServiceLocalCreate>(transport, {
        path: 'serviceLocals',
        wrapper: 'serviceLocals',
        itemRoot: 'serviceLocal',
        max: 100,
      }),
    }
    this.serviceLocalTypes = simple('serviceLocalType')
    this.serviceLocalClassifications = simple('serviceLocalClassification')
    this.local3Dimensions = simple('local3Dimension')

    // Tarefas e execução
    this.schedules = createSchedulesResource(transport)
    this.activityHistories = createActivityHistoriesResource(transport)
    this.geoCoordinates = readOnly(
      defineResource<GeoCoordinate, never, never, GeoCoordinateFilters>(transport, { path: 'geoCoordinate' }),
    )
    this.auditing = createAuditingResource(transport)

    // Rotas
    this.itineraries = defineResource<Itinerary, ItineraryCreate, ItineraryUpdate, SimpleEntityFilters>(transport, {
      path: 'itinerary',
    })

    // Vínculos
    const links = createLinkResources(transport)
    this.agentActivities = links.agentActivities
    this.scheduleItems = links.scheduleItems
    this.sectionSubGroups = links.sectionSubGroups
    this.serviceLocalActivities = links.serviceLocalActivities
    this.itineraryActivities = links.itineraryActivities
    this.itineraryAgents = links.itineraryAgents
    this.itineraryServiceLocals = links.itineraryServiceLocals

    // Customizáveis
    this.customFields = createCustomFieldsAccessor(transport)
    this.customEntities = createCustomEntitiesResource(transport)
    this.mix = createMixResource(this.customEntities)

    // Mensageria
    const messaging = createMessagingResources(transport)
    this.messages = messaging.messages
    this.pushNotifications = messaging.pushNotifications
    this.sms = messaging.sms

    // Arquivos
    const files = createFileResources(transport)
    this.importFiles = files.importFiles
    this.importLayouts = files.importLayouts
    this.exportLayouts = files.exportLayouts
  }
}

export type { BatchOptions, ListStub }
