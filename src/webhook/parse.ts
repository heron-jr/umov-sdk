import { parseXml } from '../core/xml'

export interface CallbackXmlPayload {
  /** alternativeIdentifier da tarefa (Schedule). */
  scheduleAlternativeIdentifier?: string
  /** IDs dos activityHistories recebidos. */
  activityHistoryIds: number[]
}

/**
 * Parseia o payload XML do callback de tarefas da uMov.me
 * (variante configurada via custom field 'callback' no Schedule).
 */
export function parseCallbackXml(body: string): CallbackXmlPayload {
  const doc = parseXml(body) as {
    Schedule?: {
      alternativeIdentifier?: string
      activityHistories?: { activityHistory?: { $id?: string } | Array<{ $id?: string }> }
    }
  }
  const schedule = doc.Schedule
  if (!schedule) throw new Error('Callback XML sem elemento <Schedule>')
  const histories = schedule.activityHistories?.activityHistory
  const list = histories === undefined ? [] : Array.isArray(histories) ? histories : [histories]
  return {
    scheduleAlternativeIdentifier: schedule.alternativeIdentifier || undefined,
    activityHistoryIds: list.map((h) => Number(h.$id)).filter((n) => Number.isFinite(n)),
  }
}

export interface CallbackJsonPayload {
  historyId: number | string
  taskId: number | string
  clientId: number | string
  activityId: number | string
}

/** Parseia o payload JSON do callback (variante configurada por atividade via Help Desk, HTTPS). */
export function parseCallbackJson(body: string | object): CallbackJsonPayload {
  const obj = (typeof body === 'string' ? JSON.parse(body) : body) as Record<string, unknown>
  for (const field of ['historyId', 'taskId', 'clientId', 'activityId'] as const) {
    if (obj[field] === undefined || obj[field] === null) {
      throw new Error(`Callback JSON sem o campo obrigatório '${field}'`)
    }
  }
  const norm = (v: unknown): number | string => {
    if (typeof v === 'number') return v
    const s = String(v)
    return /^\d+$/.test(s) ? Number(s) : s
  }
  return {
    historyId: norm(obj.historyId),
    taskId: norm(obj.taskId),
    clientId: norm(obj.clientId),
    activityId: norm(obj.activityId),
  }
}
