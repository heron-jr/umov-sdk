import type { EntityRef } from '../../core/types'
import { formatDate } from '../../util/datetime'
import { idOf, refToV2Path, v2Create, v2Link, v2Patch, v2Put, type V2CreateFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2Bool, V2CustomField, V2DateInput, V2IdRef, V2Image, V2Ref, V2Result, V2ServiceLocalRelation } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `NewTaskActivity` — item de `taskActivities` e body de `/tasks/{ref}/activity/{ref}`. */
export interface V2TaskActivity {
  id?: number
  alternativeIdentifier?: string
  executed?: boolean
  finalized?: boolean
  executionStatus?: 'CANCELLED_OR_INACTIVATED' | 'EXECUTED' | 'NOT_EXECUTED' | 'PENDING_EXECUTION'
  hideMobile?: V2Bool
  mandatory?: V2Bool
}

/** `NewTaskItem` — item de `taskItems` e body de `/tasks/{ref}/item/{ref}`. */
export interface V2TaskItem {
  id?: number
  alternativeIdentifier?: string
  customFields?: V2CustomField[]
}

export type V2TaskActivityOrigin =
  | 'ENVIRONMENT_DEFAULT'
  | 'INFORMED_ACTIVITIES'
  | 'MOBILE_ROUTE'
  | 'PERSON_DEFAULT'
  | 'SERVICE_LOCAL_DEFAULT'
  | 'TASK_TYPE'
  | 'TEAM_ACTIVITIES'
  | 'TEAM_AND_LOCAL'

export type V2TeamExecution = 'ALL_CAN_EXECUTE' | 'DONT_EXECUTE_FOR_TEAM' | 'ONLY_ONE_CAN_EXECUTE'

/** `Create Task` — POST /tasks, PUT|PATCH /tasks/{ref}. */
export interface V2Task {
  alternativeIdentifier?: string
  active?: boolean
  agent?: V2Ref
  team?: V2Ref
  /** Obrigatório se `team` informado. */
  teamExecutionId?: V2TeamExecution
  serviceLocal?: V2Ref
  serviceLocalOrigin?: V2Ref
  taskType?: V2Ref
  /** 20 preparação · 30 pendente · 40 em campo · 50 retornada · 70 cancelada. */
  situationId?: number
  /** Alternativa a `situationId` (`{ id: 30 }`). */
  taskStatus?: V2Ref
  initialDate?: V2DateInput
  /** HH:mm */
  initialHour?: string
  finalDate?: V2DateInput
  finalHour?: string
  /** 0 = urgente. */
  priority?: number
  observation?: string
  negativeReason?: string
  group?: string
  routePlan?: string
  activityOriginList?: V2TaskActivityOrigin[]
  taskActivities?: V2TaskActivity[]
  taskItems?: V2TaskItem[]
  customFields?: V2CustomField[]
  customField1?: string
  customField2?: string
  customField3?: string
  image?: V2Image
  /** A spec documenta como string JSON; aceita o objeto tipado ou a string. */
  recurrenceConfiguration?: V2RecurrenceConfiguration | string
  recreateAfterDone?: boolean
  sendNotification?: boolean
  sendSituationToInField?: boolean
  changeLocal?: boolean
  autoFinished?: boolean
  skipAgentJourneyValidation?: boolean
  validateDateTimeExecution?: boolean
  verificationCode?: string
  capacityConsumption?: number
  capacityDemand?: number
  toleranceBeforeStart?: number
  toleranceAfterStart?: number
  toleranceBeforeEnd?: number
  toleranceAfterEnd?: number
  toleranceBlockBefore?: number
  toleranceBlockAfter?: number
  waitTimeOnField?: number
}

/** `AddHistoryCommand` — POST /tasks/history. */
export interface V2TaskHistory {
  taskAlternativeIdentifier?: string
  activityAlternativeIdentifier?: string
  fields?: { fieldAlternativeIdentifier?: string; value?: string }[]
}

/** `NewTaskPrioritizeDTO` — item do array de PATCH /tasks/prioritize. */
export interface V2TaskPrioritize {
  id?: number
  priority?: number
  initialDate?: V2DateInput
  initialHour?: string
  finalDate?: V2DateInput
  finalHour?: string
}

/** POST /tasks/recede — regride a situação (40→30, 30→20, 70→30). */
export type V2TaskRecede = { id: number } | { ids: number[] } | { alternativeIdentifier: string } | { alternativeIdentifiers: string[] }

/** `TransferTaskDTO` — POST /tasks/transfer. */
export type V2TaskTransfer = ({ taskIds: number[] } | { taskAlternativeIdentifiers: string[] }) &
  ({ destinationAgentId: number } | { destinationAgentAlternativeIdentifier: string }) & { initialDate?: V2DateInput }

/** `CopyTaskDTO` — POST /tasks/copy. */
export interface V2TaskCopy {
  id?: number
  alternativeIdentifier?: string
}

/** `Contrato referente ao tipo de tarefa no umov.me` — description obrigatório na criação. */
export interface V2TaskType {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  activities?: V2Ref[]
  /** '1' sim · '0' não. */
  allowChat?: string
  allowEvaluationJob?: boolean
  allowTaskCreationOnMobile?: boolean
  delayedStart?: boolean
  earlyStart?: boolean
  earlyEnd?: boolean
  lateEnd?: boolean
  mobileRouting?: boolean
  multipleLocalsTask?: boolean
  multiplePeopleTask?: boolean
  showPrintScheduleData?: boolean
  skipValidateWallet?: boolean
}

/** `Contrato referente ao tipo de tarefa e atividade no umov.me` — POST /taskType/taskTypeActivity. */
export interface V2TaskTypeActivityLink {
  activity: V2Ref
  taskType: V2Ref
}

/** `RecurrenceEndsConfiguration` (sem `domainEvents`/`validations`). */
export interface V2RecurrenceEnds {
  type?: 'DATE' | 'NEVER' | 'OCCURRENCES'
  date?: V2DateInput
  occurrences?: number
}

/** `RecurrenceRepeatConfiguration` (sem `domainEvents`/`validations`). */
export interface V2RecurrenceRepeat {
  value?: number
  unit?: 'DAY' | 'MONTH' | 'WEEK'
  type?: 'DAY_IN_MONTH' | 'WEEK_IN_MONTH'
}

/** `RecurrenceConfiguration` (sem `domainEvents`/`validations`). */
export interface V2RecurrenceConfiguration {
  repeatMode?: 'DAILY' | 'FIXED' | 'MONTHLY' | 'WEEKLY'
  repeatEvery?: V2RecurrenceRepeat
  /** 1 = domingo … 7 = sábado (conforme exemplo da spec). */
  weekdays?: number[]
  monthDay?: number
  monthlyRepetition?: number
  ends?: V2RecurrenceEnds
}

export type V2ScheduleActivityOrigin =
  | 'AGENT_ACTIVITIES'
  | 'ALL_ACTIVITIES'
  | 'ITINERARY_ACTIVITIES'
  | 'SCHEDULE_TYPE_ACTIVITIES'
  | 'SERVICELOCAL_ACTIVITIES'
  | 'SYSTEMPARAMETERS_ACTIVITIES'

/** `ServiceLocalRelationship` — aceita `serviceLocal` aninhado ou o formato legado achatado. */
export interface V2TaskScheduleServiceLocal {
  serviceLocal?: V2Ref
  serviceLocalId?: number
  alternativeIdentifier?: string
  treatmentOrder?: number
  initialHour?: string
  finalHour?: string
}

/**
 * `TaskSchedule` — POST /task-schedule, PUT|PATCH /task-schedule/{ref}.
 * Obrigatórios na criação: `active, activityOriginList, agentRelationship, description, initialDate, recurrenceConfiguration, taskScheduleServiceLocals`.
 */
export interface V2TaskSchedule {
  alternativeIdentifier?: string
  description?: string
  active?: V2Bool
  initialDate?: V2DateInput
  recurrenceConfiguration?: V2RecurrenceConfiguration
  agentRelationship?: 'ALL_AGENTS' | 'SOME_AGENTS' | 'SOME_TEAMS'
  activityOriginList?: V2ScheduleActivityOrigin[]
  /** '0' algumas pesquisas · '1' todas as pesquisas. */
  activityRelation?: string
  createScheduleServiceLocal?: V2Bool
  exclusive?: V2Bool
  displayOrder?: number
  /** `LocalTime` da spec. */
  executeConfiguration?: { hour?: string; minute?: string; second?: string; nano?: number }
  repeatedLocals?: 'ALLOW' | 'DENY'
  validateTaskInField?: 'ALWAYS_CREATE' | 'NOT_VALIDATE' | 'VALIDATE_PENDING'
  teamExecution?: V2TeamExecution
  scheduleType?: V2Ref
  taskType?: V2Ref
  taskTypeId?: number
  taskScheduleActivities?: { activity?: V2Ref; activityId?: number; alternativeIdentifier?: string }[]
  taskScheduleAgents?: { agent?: V2Ref; agentId?: number; alternativeIdentifier?: string }[]
  taskScheduleTeams?: { team?: V2Ref; teamId?: number; alternativeIdentifier?: string }[]
  taskScheduleServiceLocals?: V2TaskScheduleServiceLocal[]
}

/** `DuplicateTaskSchedule` — POST /task-schedule/{ref}/duplicate (description obrigatório). */
export interface V2DuplicateTaskSchedule {
  description: string
  alternativeIdentifier?: string
  /** Se omitida, usa a data inicial da programação de origem. */
  initialDate?: V2DateInput
}

/** `Contrato de escrita de uma geocoordenada no uMov.me` — POST /geocoordinate (`agentId`, `latitude`, `longitude` obrigatórios). */
export interface V2Geocoordinate {
  agentId?: V2Ref
  latitude?: number
  longitude?: number
  date?: V2DateInput
  /** HHmmss */
  hour?: string
  /** date-time ISO. */
  dateHour?: string
  /** Só por id. */
  historyId?: V2Ref
  collectedOfPrecision?: number
  gpsEnabled?: number
  networkEnabled?: number
  withGps?: number
  levelBatteryMobile?: number
  observation?: string
  provider?: string
  quantityAttempts?: number
  type?: number
  validForecast?: V2Bool
}

// ---------- Normalização de datas (yyyy-MM-dd) ----------

function normalizeDates<T extends object>(payload: T, keys: (keyof T)[]): T {
  const out = { ...(payload as Record<string, unknown>) }
  for (const key of keys) {
    const v = out[key as string]
    if (v instanceof Date) out[key as string] = formatDate(v)
  }
  return out as T
}

const normalizeTask = (p: V2Task): V2Task => normalizeDates(p, ['initialDate', 'finalDate'])
const normalizePrioritize = (p: V2TaskPrioritize): V2TaskPrioritize => normalizeDates(p, ['initialDate', 'finalDate'])
const normalizeInitialDate = <T extends { initialDate?: V2DateInput }>(p: T): T => normalizeDates(p, ['initialDate'])

function normalizeSchedule(p: V2TaskSchedule): V2TaskSchedule {
  const out = normalizeInitialDate(p)
  const ends = out.recurrenceConfiguration?.ends
  if (ends?.date instanceof Date) {
    out.recurrenceConfiguration = { ...out.recurrenceConfiguration, ends: normalizeDates(ends, ['date']) }
  }
  return out
}

// ---------- Recursos ----------

export interface V2TasksResource {
  create: V2CreateFn<V2Task>
  put: V2WriteFn<V2Task>
  patch: V2WriteFn<V2Task>
  /** `/tasks/{ref}/activity/{ref}` — refs do mesmo tipo (id/id ou altId/altId). */
  activities: {
    add(taskRef: EntityRef, activityRef: EntityRef, body?: V2TaskActivity): Promise<V2Result>
    remove(taskRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
    patch(taskRef: EntityRef, activityRef: EntityRef, body: V2TaskActivity): Promise<V2Result>
  }
  /** `/tasks/{ref}/item/{ref}` — refs do mesmo tipo. */
  items: {
    add(taskRef: EntityRef, itemRef: EntityRef, body?: V2TaskItem): Promise<V2Result>
    put(taskRef: EntityRef, itemRef: EntityRef, body: V2TaskItem): Promise<V2Result>
    remove(taskRef: EntityRef, itemRef: EntityRef): Promise<V2Result>
    patch(taskRef: EntityRef, itemRef: EntityRef, body: V2TaskItem): Promise<V2Result>
  }
  /** POST /tasks/history — lança histórico de uma atividade da tarefa. */
  history(cmd: V2TaskHistory): Promise<V2Result>
  /** PATCH /tasks/prioritize — reprioriza/reagenda em lote. */
  prioritize(items: V2TaskPrioritize[]): Promise<V2Result>
  /** POST /tasks/recede — regride a situação (40→30, 30→20, 70→30). */
  recede(selection: V2TaskRecede): Promise<V2Result>
  /** POST /tasks/transfer — transfere tarefas para outro agente. */
  transfer(dto: V2TaskTransfer): Promise<V2Result>
  /** POST /tasks/copy */
  copy(body: V2TaskCopy): Promise<V2Result>
}

export interface V2TaskTypesResource {
  create: V2CreateFn<V2TaskType>
  put: V2WriteFn<V2TaskType>
  patch: V2WriteFn<V2TaskType>
  /** A spec só expõe DELETE por identificador alternativo (`/taskType/alt-id/{altId}`). */
  remove(altId: string): Promise<V2Result>
  /** `/taskType/{ref}/activity/{ref}` — refs do mesmo tipo. */
  activities: {
    add(taskTypeRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
    remove(taskTypeRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
    /** DELETE /taskType/{ref}/activities */
    removeAll(taskTypeRef: EntityRef): Promise<V2Result>
  }
  /** POST /taskType/taskTypeActivity */
  linkActivity(body: V2TaskTypeActivityLink): Promise<V2Result>
  /** DELETE /taskType/taskTypeActivity/{id} — id do vínculo. */
  unlinkActivity(ref: V2IdRef): Promise<V2Result>
}

export interface V2TaskSchedulesResource {
  create: V2CreateFn<V2TaskSchedule>
  put: V2WriteFn<V2TaskSchedule>
  patch: V2WriteFn<V2TaskSchedule>
  /** POST /task-schedule/{ref}/duplicate */
  duplicate(ref: EntityRef, body: V2DuplicateTaskSchedule): Promise<V2Result>
  activities: {
    add(scheduleRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
    remove(scheduleRef: EntityRef, activityRef: EntityRef): Promise<V2Result>
  }
  agents: {
    add(scheduleRef: EntityRef, agentRef: EntityRef): Promise<V2Result>
    remove(scheduleRef: EntityRef, agentRef: EntityRef): Promise<V2Result>
  }
  teams: {
    add(scheduleRef: EntityRef, teamRef: EntityRef): Promise<V2Result>
    remove(scheduleRef: EntityRef, teamRef: EntityRef): Promise<V2Result>
  }
  /** `/task-schedule/{ref}/service-local/{ref}` */
  serviceLocals: {
    add(scheduleRef: EntityRef, localRef: EntityRef, body?: V2ServiceLocalRelation): Promise<V2Result>
    remove(scheduleRef: EntityRef, localRef: EntityRef): Promise<V2Result>
    patch(scheduleRef: EntityRef, localRef: EntityRef, body: V2ServiceLocalRelation): Promise<V2Result>
  }
}

export interface V2GeocoordinatesResource {
  create: V2CreateFn<V2Geocoordinate>
}

export interface V2TaskResources {
  tasks: V2TasksResource
  taskTypes: V2TaskTypesResource
  taskSchedules: V2TaskSchedulesResource
  geocoordinates: V2GeocoordinatesResource
}

export function createTaskResources(t: TransportV2): V2TaskResources {
  const taskActivities = v2Link<V2TaskActivity>(t, 'tasks', 'activity')
  const taskItems = v2Link<V2TaskItem>(t, 'tasks', 'item')
  const taskTypeActivities = v2Link(t, 'taskType', 'activity')
  const scheduleActivities = v2Link(t, 'task-schedule', 'activity')
  const scheduleAgents = v2Link(t, 'task-schedule', 'agent')
  const scheduleTeams = v2Link(t, 'task-schedule', 'team')
  const scheduleLocals = v2Link<V2ServiceLocalRelation>(t, 'task-schedule', 'service-local')
  return {
    tasks: {
      create: v2Create(t, 'tasks', normalizeTask),
      put: v2Put(t, 'tasks', normalizeTask),
      patch: v2Patch(t, 'tasks', normalizeTask),
      activities: { add: taskActivities.add, remove: taskActivities.remove, patch: taskActivities.patch },
      items: { add: taskItems.add, put: taskItems.put, remove: taskItems.remove, patch: taskItems.patch },
      history: (cmd) => t.post('tasks/history', cmd),
      prioritize: (items) => t.patch('tasks/prioritize', items.map(normalizePrioritize)),
      recede: (selection) => t.post('tasks/recede', selection),
      transfer: (dto) => t.post('tasks/transfer', normalizeInitialDate(dto)),
      copy: (body) => t.post('tasks/copy', body),
    },
    taskTypes: {
      create: v2Create(t, 'taskType'),
      put: v2Put(t, 'taskType'),
      patch: v2Patch(t, 'taskType'),
      remove: (altId) => t.delete(`taskType/${refToV2Path({ altId })}`),
      activities: {
        add: (a, b) => taskTypeActivities.add(a, b),
        remove: taskTypeActivities.remove,
        removeAll: (ref) => t.delete(`taskType/${refToV2Path(ref)}/activities`),
      },
      linkActivity: (body) => t.post('taskType/taskTypeActivity', body),
      unlinkActivity: (ref) => t.delete(`taskType/taskTypeActivity/${idOf(ref)}`),
    },
    taskSchedules: {
      create: v2Create(t, 'task-schedule', normalizeSchedule),
      put: v2Put(t, 'task-schedule', normalizeSchedule),
      patch: v2Patch(t, 'task-schedule', normalizeSchedule),
      duplicate: (ref, body) => t.post(`task-schedule/${refToV2Path(ref)}/duplicate`, normalizeInitialDate(body)),
      activities: { add: (a, b) => scheduleActivities.add(a, b), remove: scheduleActivities.remove },
      agents: { add: (a, b) => scheduleAgents.add(a, b), remove: scheduleAgents.remove },
      teams: { add: (a, b) => scheduleTeams.add(a, b), remove: scheduleTeams.remove },
      serviceLocals: { add: scheduleLocals.add, remove: scheduleLocals.remove, patch: scheduleLocals.patch },
    },
    geocoordinates: {
      create: v2Create(t, 'geocoordinate', (p: V2Geocoordinate) => normalizeDates(p, ['date'])),
    },
  }
}
