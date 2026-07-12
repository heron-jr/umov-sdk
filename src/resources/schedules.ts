import { defineBatch, defineResource, type BatchOptions, type Resource } from '../core/resource'
import { parseXml, serializeEntity } from '../core/xml'
import { formatDate, formatDateTime } from '../util/datetime'
import type { EntityRef, ListStub } from '../core/types'
import type { Transport } from '../core/transport'
import type { Schedule, ScheduleCreate, ScheduleFilters, ScheduleRoutingRequest, ScheduleUpdate } from './types'

export interface SchedulesResource extends Resource<Schedule, ScheduleCreate, ScheduleUpdate, ScheduleFilters> {
  /**
   * Cancela a tarefa (POST situation.id=70).
   * A API rejeita se a tarefa já está executada (50) ou cancelada (70).
   */
  cancel(ref: EntityRef): Promise<void>
  /** Upsert em lote — máx. 50 (limite específico de schedules), ATÔMICO. */
  upsertBatch(items: ScheduleCreate[], opts?: BatchOptions): Promise<ListStub[]>
  /**
   * Roteirizador: ordena até 50 tarefas por distância em linha reta a partir da origem.
   * Todas as tarefas precisam de GPS válido, ou a API retorna erro.
   * Com updateSchedules (default true), tarefas 'Em Preparação' passam a 'Pendente de Envio'.
   * Shape da resposta não é documentado — retorna a árvore XML parseada.
   */
  route(request: ScheduleRoutingRequest): Promise<Record<string, unknown>>
}

function normalizeDate<T extends { date?: Date | string }>(payload: T): T {
  if (payload.date instanceof Date) return { ...payload, date: formatDate(payload.date) }
  return payload
}

export function createSchedulesResource(transport: Transport): SchedulesResource {
  const base = defineResource<Schedule, ScheduleCreate, ScheduleUpdate, ScheduleFilters>(transport, {
    path: 'schedule',
  })
  const batch = defineBatch<ScheduleCreate>(transport, {
    path: 'schedules',
    wrapper: 'schedules',
    itemRoot: 'schedule',
    max: 50,
  })
  return {
    ...base,
    create: (payload) => base.create(normalizeDate(payload)),
    update: (ref, payload) => base.update(ref, normalizeDate(payload)),
    cancel: (ref) => base.update(ref, { situation: { id: 70 } }),
    upsertBatch: (items, opts) => batch(items.map(normalizeDate), opts),
    async route(request) {
      if (request.schedules.length > 50) {
        throw new RangeError(`scheduleRouting aceita no máximo 50 tarefas (recebeu ${request.schedules.length})`)
      }
      const xml = serializeEntity('scheduleRouting', {
        route: request.route,
        updateSchedules: request.updateSchedules,
        startTime: request.startTime !== undefined ? formatDateTime(request.startTime) : undefined,
        estimate: request.estimate,
        origin: request.origin,
        schedules: {
          schedule: request.schedules.map((s) => ({
            ...s.schedule,
            dependencies: s.dependencies ? { schedule: s.dependencies } : undefined,
          })),
        },
      })
      return parseXml(await transport.post('scheduleRouting.xml', xml))
    },
  }
}
