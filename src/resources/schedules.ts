import { defineResource, type Resource } from '../core/resource'
import { formatDate } from '../util/datetime'
import type { EntityRef } from '../core/types'
import type { Transport } from '../core/transport'
import type { Schedule, ScheduleCreate, ScheduleFilters, ScheduleUpdate } from './types'

export interface SchedulesResource extends Resource<Schedule, ScheduleCreate, ScheduleUpdate, ScheduleFilters> {
  /**
   * Cancela a tarefa (POST situation.id=70).
   * A API rejeita se a tarefa já está executada (50) ou cancelada (70).
   */
  cancel(ref: EntityRef): Promise<void>
}

function normalizeDate<T extends { date?: Date | string }>(payload: T): T {
  if (payload.date instanceof Date) return { ...payload, date: formatDate(payload.date) }
  return payload
}

export function createSchedulesResource(transport: Transport): SchedulesResource {
  const base = defineResource<Schedule, ScheduleCreate, ScheduleUpdate, ScheduleFilters>(transport, {
    path: 'schedule',
  })
  return {
    ...base,
    create: (payload) => base.create(normalizeDate(payload)),
    update: (ref, payload) => base.update(ref, normalizeDate(payload)),
    cancel: (ref) => base.update(ref, { situation: { id: 70 } }),
  }
}
