import { UmovConfigError } from '../core/errors'
import { TransportV2, type TransportV2Options } from './transport'
import { createAgentResources, type V2AgentResources } from './resources/agents'
import { createTeamResources, type V2TeamResources } from './resources/teams'
import { createItemResources, type V2ItemResources } from './resources/items'
import { createLocalResources, type V2LocalResources } from './resources/locals'
import { createTaskResources, type V2TaskResources } from './resources/tasks'
import { createActivityResources, type V2ActivityResources } from './resources/activities'
import { createCustomResources, type V2CustomResources } from './resources/custom'
import { createItineraryResources, type V2ItineraryResources } from './resources/itineraries'
import { createPlatformResources, type V2PlatformResources } from './resources/platform'

export type UmovV2Options = TransportV2Options

/**
 * Cliente da API 2.0 (JSON). Só escrita: a v2 não tem GET — leia pela v1 (`UmovClient`).
 * Usado por `umov.v2` ou avulso: `new UmovV2Client({ appId, appKey })`.
 * Mapa de recursos: docs/entities.md "API 2.0 (JSON)"; API: docs/api-v2.md.
 */
export class UmovV2Client {
  /** Transporte JSON — exposto para quem precisar chamar um path ainda não mapeado pelo SDK. */
  readonly transport: TransportV2

  // Pessoas
  readonly agents: V2AgentResources['agents']
  readonly agentTypes: V2AgentResources['agentTypes']
  readonly absences: V2AgentResources['absences']
  readonly workJourneys: V2AgentResources['workJourneys']
  readonly workDayJourneys: V2AgentResources['workDayJourneys']
  readonly passwordPolicies: V2AgentResources['passwordPolicies']
  readonly teams: V2TeamResources['teams']
  // Itens
  readonly items: V2ItemResources['items']
  readonly subGroups: V2ItemResources['subGroups']
  readonly additionalInfoItems: V2ItemResources['additionalInfoItems']
  // Locais
  readonly locals: V2LocalResources['locals']
  readonly localTypes: V2LocalResources['localTypes']
  readonly localGroups: V2LocalResources['localGroups']
  readonly localClassifications: V2LocalResources['localClassifications']
  readonly tags: V2LocalResources['tags']
  // Tarefas
  readonly tasks: V2TaskResources['tasks']
  readonly taskTypes: V2TaskResources['taskTypes']
  readonly taskSchedules: V2TaskResources['taskSchedules']
  readonly geocoordinates: V2TaskResources['geocoordinates']
  // Formulários (escrita — a v1 só lê)
  readonly activities: V2ActivityResources['activities']
  readonly activityTypes: V2ActivityResources['activityTypes']
  readonly formulas: V2ActivityResources['formulas']
  // Customizáveis
  readonly customEntities: V2CustomResources['customEntities']
  readonly customEntityEntries: V2CustomResources['customEntityEntries']
  readonly customFields: V2CustomResources['customFields']
  // Rotas
  readonly itineraries: V2ItineraryResources['itineraries']
  // Plataforma / admin
  readonly media: V2PlatformResources['media']
  readonly systemParameters: V2PlatformResources['systemParameters']
  readonly appearances: V2PlatformResources['appearances']
  readonly featureToggles: V2PlatformResources['featureToggles']

  constructor(options: UmovV2Options) {
    if (options.appId === undefined || options.appId === '' || !options.appKey) {
      throw new UmovConfigError('UmovV2Client: appId e appKey são obrigatórios')
    }
    const t = (this.transport = new TransportV2(options))

    const agents = createAgentResources(t)
    this.agents = agents.agents
    this.agentTypes = agents.agentTypes
    this.absences = agents.absences
    this.workJourneys = agents.workJourneys
    this.workDayJourneys = agents.workDayJourneys
    this.passwordPolicies = agents.passwordPolicies
    this.teams = createTeamResources(t).teams

    const items = createItemResources(t)
    this.items = items.items
    this.subGroups = items.subGroups
    this.additionalInfoItems = items.additionalInfoItems

    const locals = createLocalResources(t)
    this.locals = locals.locals
    this.localTypes = locals.localTypes
    this.localGroups = locals.localGroups
    this.localClassifications = locals.localClassifications
    this.tags = locals.tags

    const tasks = createTaskResources(t)
    this.tasks = tasks.tasks
    this.taskTypes = tasks.taskTypes
    this.taskSchedules = tasks.taskSchedules
    this.geocoordinates = tasks.geocoordinates

    const activities = createActivityResources(t)
    this.activities = activities.activities
    this.activityTypes = activities.activityTypes
    this.formulas = activities.formulas

    const custom = createCustomResources(t)
    this.customEntities = custom.customEntities
    this.customEntityEntries = custom.customEntityEntries
    this.customFields = custom.customFields

    this.itineraries = createItineraryResources(t).itineraries

    const platform = createPlatformResources(t)
    this.media = platform.media
    this.systemParameters = platform.systemParameters
    this.appearances = platform.appearances
    this.featureToggles = platform.featureToggles
  }
}
