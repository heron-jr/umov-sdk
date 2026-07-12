import { Transport, type TransportOptions } from './core/transport'
import { defineResource } from './core/resource'
import { createSchedulesResource, type SchedulesResource } from './resources/schedules'
import {
  createActivityHistoriesResource,
  type ActivityHistoriesResource,
} from './resources/activity-histories'
import { createCustomFieldsAccessor, type CustomFieldsAccessor } from './resources/custom-fields'
import type {
  Activity,
  ActivityFilters,
  Agent,
  AgentCreate,
  AgentFilters,
  AgentUpdate,
  GeoCoordinate,
  GeoCoordinateFilters,
  Section,
  SectionField,
  SectionFieldFilters,
  SectionFilters,
  ServiceLocal,
  ServiceLocalCreate,
  ServiceLocalFilters,
  ServiceLocalUpdate,
} from './resources/types'

export type UmovClientOptions = TransportOptions

/** Remove create/update da superfície pública de recursos somente leitura. */
function readOnly<T extends { create: unknown; update: unknown }>(resource: T): Omit<T, 'create' | 'update'> {
  const { create: _c, update: _u, ...rest } = resource
  return rest
}

export class UmovClient {
  readonly agents
  readonly serviceLocals
  readonly activities
  readonly sections
  readonly sectionFields
  readonly geoCoordinates
  readonly schedules: SchedulesResource
  readonly activityHistories: ActivityHistoriesResource
  readonly customFields: CustomFieldsAccessor

  constructor(options: UmovClientOptions) {
    if (!options.apiKey) throw new Error('UmovClient: apiKey é obrigatória')
    const transport = new Transport(options)

    this.agents = defineResource<Agent, AgentCreate, AgentUpdate, AgentFilters>(transport, { path: 'agent' })
    this.serviceLocals = defineResource<ServiceLocal, ServiceLocalCreate, ServiceLocalUpdate, ServiceLocalFilters>(
      transport,
      { path: 'serviceLocal' },
    )
    // Read-only por limitação da API (spec §2): Activity/Section/SectionField/GeoCoordinate não aceitam escrita.
    this.activities = readOnly(defineResource<Activity, never, never, ActivityFilters>(transport, { path: 'activity' }))
    this.sections = readOnly(defineResource<Section, never, never, SectionFilters>(transport, { path: 'section' }))
    this.sectionFields = readOnly(
      defineResource<SectionField, never, never, SectionFieldFilters>(transport, { path: 'sectionField' }),
    )
    this.geoCoordinates = readOnly(
      defineResource<GeoCoordinate, never, never, GeoCoordinateFilters>(transport, { path: 'geoCoordinate' }),
    )

    this.schedules = createSchedulesResource(transport)
    this.activityHistories = createActivityHistoriesResource(transport)
    this.customFields = createCustomFieldsAccessor(transport)
  }
}
