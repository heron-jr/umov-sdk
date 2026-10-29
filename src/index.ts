export { UmovClient, type UmovClientCredentialsOptions, type UmovClientOptions } from './client'
export { getToken, type TokenCredentials } from './core/token'
export * from './core/errors'
export { decodeCustomFieldName } from './core/xml'
export type { EntityRef, ListPage, ListStub, RelationRef } from './core/types'
export type { BatchOptions, IterateOptions, ListOptions, Resource } from './core/resource'
export type { UmovLogEvent } from './core/transport'
export type { SchedulesResource } from './resources/schedules'
export type { ActivityHistoriesResource, ActivityHistoryCreate } from './resources/activity-histories'
export type {
  CustomFieldFilters,
  CustomFieldOwner,
  CustomFieldsAccessor,
  EntityCustomFields,
} from './resources/custom-fields'
export type { TeamsResource } from './resources/teams'
export type {
  DeletableLinkResource,
  ItineraryLinkResource,
  LinkFilters,
  LinkResource,
  ScheduleItemsResource,
  SectionSubGroupsResource,
} from './resources/links'
export type {
  MessageSend,
  MessagesResource,
  PushNotificationSend,
  PushNotificationsResource,
  SmsResource,
  SmsSend,
  SmsTarget,
} from './resources/messaging'
export type { AuditingFilters, AuditingResource, AuditingValueFilters } from './resources/auditing'
export type { CustomEntitiesResource, CustomEntityEntriesResource } from './resources/custom-entities'
export type { MixResource } from './resources/mix'
export type { ExportLayoutsResource, ImportFilesResource, ImportLayoutsResource } from './resources/files'
export * from './resources/types'
export { formatDate, formatDateTime } from './util/datetime'

// API 2.0 (JSON)
export { UmovV2Client, type UmovV2Options } from './v2/client'
export type { TransportV2Options, V2Method } from './v2/transport'
export type { V2Link, V2CreateFn, V2WriteFn, V2DeleteFn } from './v2/resource'
export * from './v2/types'
export * from './v2/resources'
