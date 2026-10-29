import { describe, expect, it } from 'vitest'
import { createTaskResources } from '../../../src/v2/resources/tasks'
import { mockTransport } from '../helpers'

describe('v2 tasks', () => {
  const { transport, last } = mockTransport()
  const r = createTaskResources(transport)

  it('tasks create/put/patch (normaliza datas)', async () => {
    await r.tasks.create({
      alternativeIdentifier: 'T-1',
      agent: { alternativeIdentifier: 'ana' },
      serviceLocal: { id: 3 },
      initialDate: new Date(2026, 10, 5),
      finalDate: '2026-11-06',
      taskActivities: [{ alternativeIdentifier: 'VIS', mandatory: 'TRUE' }],
    })
    expect(last()).toEqual({
      method: 'POST',
      path: 'tasks',
      body: {
        alternativeIdentifier: 'T-1',
        agent: { alternativeIdentifier: 'ana' },
        serviceLocal: { id: 3 },
        initialDate: '2026-11-05',
        finalDate: '2026-11-06',
        taskActivities: [{ alternativeIdentifier: 'VIS', mandatory: 'TRUE' }],
      },
    })
    await r.tasks.put({ altId: 'T-1' }, { initialDate: new Date(2026, 10, 5), finalDate: new Date(2026, 10, 7) })
    expect(last()).toEqual({ method: 'PUT', path: 'tasks/alt-id/T-1', body: { initialDate: '2026-11-05', finalDate: '2026-11-07' } })
    await r.tasks.patch(9, { observation: 'obs', finalDate: new Date(2026, 10, 8) })
    expect(last()).toEqual({ method: 'PATCH', path: 'tasks/9', body: { observation: 'obs', finalDate: '2026-11-08' } })
  })

  it('tasks.activities add/remove/patch', async () => {
    await r.tasks.activities.add({ altId: 'T-1' }, { altId: 'VIS' }, { mandatory: 'TRUE' })
    expect(last()).toEqual({ method: 'POST', path: 'tasks/alt-id/T-1/activity/alt-id/VIS', body: { mandatory: 'TRUE' } })
    await r.tasks.activities.remove(1, 2)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'tasks/1/activity/2' })
    await r.tasks.activities.patch(1, 2, { executed: true })
    expect(last()).toEqual({ method: 'PATCH', path: 'tasks/1/activity/2', body: { executed: true } })
  })

  it('tasks.items add/put/remove/patch', async () => {
    await r.tasks.items.add(1, 5, { customFields: [{ alternativeIdentifier: 'qtd', value: '2' }] })
    expect(last()).toEqual({ method: 'POST', path: 'tasks/1/item/5', body: { customFields: [{ alternativeIdentifier: 'qtd', value: '2' }] } })
    await r.tasks.items.put({ altId: 'T-1' }, { altId: 'IT-1' }, { customFields: [] })
    expect(last()).toMatchObject({ method: 'PUT', path: 'tasks/alt-id/T-1/item/alt-id/IT-1' })
    await r.tasks.items.remove(1, 5)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'tasks/1/item/5' })
    await r.tasks.items.patch(1, 5, { customFields: [{ alternativeIdentifier: 'qtd', value: '3' }] })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'tasks/1/item/5' })
  })

  it('tasks history/prioritize/recede/transfer/copy', async () => {
    const history = { taskAlternativeIdentifier: 'T-1', activityAlternativeIdentifier: 'VIS', fields: [{ fieldAlternativeIdentifier: 'obs', value: 'ok' }] }
    await r.tasks.history(history)
    expect(last()).toEqual({ method: 'POST', path: 'tasks/history', body: history })

    await r.tasks.prioritize([
      { id: 1, priority: 0, initialDate: new Date(2026, 10, 5), initialHour: '08:00', finalDate: new Date(2026, 10, 5), finalHour: '10:00' },
      { id: 2, priority: 1, initialDate: '2026-11-06' },
    ])
    expect(last()).toEqual({
      method: 'PATCH',
      path: 'tasks/prioritize',
      body: [
        { id: 1, priority: 0, initialDate: '2026-11-05', initialHour: '08:00', finalDate: '2026-11-05', finalHour: '10:00' },
        { id: 2, priority: 1, initialDate: '2026-11-06' },
      ],
    })

    await r.tasks.recede({ ids: [1, 2] })
    expect(last()).toEqual({ method: 'POST', path: 'tasks/recede', body: { ids: [1, 2] } })

    await r.tasks.transfer({ taskIds: [1, 2], destinationAgentId: 7, initialDate: new Date(2026, 10, 5) })
    expect(last()).toEqual({ method: 'POST', path: 'tasks/transfer', body: { taskIds: [1, 2], destinationAgentId: 7, initialDate: '2026-11-05' } })

    await r.tasks.copy({ alternativeIdentifier: 'T-1' })
    expect(last()).toEqual({ method: 'POST', path: 'tasks/copy', body: { alternativeIdentifier: 'T-1' } })
  })

  it('taskTypes create/put/patch/remove', async () => {
    await r.taskTypes.create({ description: 'Visita', alternativeIdentifier: 'VISITA' })
    expect(last()).toEqual({ method: 'POST', path: 'taskType', body: { description: 'Visita', alternativeIdentifier: 'VISITA' } })
    await r.taskTypes.put('VISITA', { description: 'Visita técnica' })
    expect(last()).toMatchObject({ method: 'PUT', path: 'taskType/alt-id/VISITA' })
    await r.taskTypes.patch(3, { active: false })
    expect(last()).toMatchObject({ method: 'PATCH', path: 'taskType/3' })
    await r.taskTypes.remove('TT-1')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'taskType/alt-id/TT-1' })
  })

  it('taskTypes.activities e taskTypeActivity', async () => {
    await r.taskTypes.activities.add({ altId: 'VISITA' }, { altId: 'VIS' })
    expect(last()).toMatchObject({ method: 'POST', path: 'taskType/alt-id/VISITA/activity/alt-id/VIS' })
    await r.taskTypes.activities.remove(3, 4)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'taskType/3/activity/4' })
    await r.taskTypes.activities.removeAll('VISITA')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'taskType/alt-id/VISITA/activities' })
    await r.taskTypes.linkActivity({ activity: { alternativeIdentifier: 'VIS' }, taskType: { id: 3 } })
    expect(last()).toEqual({ method: 'POST', path: 'taskType/taskTypeActivity', body: { activity: { alternativeIdentifier: 'VIS' }, taskType: { id: 3 } } })
    await r.taskTypes.unlinkActivity({ id: 11 })
    expect(last()).toMatchObject({ method: 'DELETE', path: 'taskType/taskTypeActivity/11' })
  })

  it('taskSchedules create/put/patch/duplicate (normaliza datas)', async () => {
    await r.taskSchedules.create({
      description: 'Rota semanal',
      active: 'TRUE',
      agentRelationship: 'SOME_AGENTS',
      activityOriginList: ['ALL_ACTIVITIES'],
      initialDate: new Date(2026, 10, 5),
      recurrenceConfiguration: { repeatMode: 'WEEKLY', repeatEvery: { value: 1, unit: 'WEEK' }, weekdays: [1, 3], ends: { type: 'DATE', date: new Date(2026, 11, 31) } },
      taskScheduleServiceLocals: [{ serviceLocal: { id: 3 }, treatmentOrder: 1 }],
    })
    expect(last()).toEqual({
      method: 'POST',
      path: 'task-schedule',
      body: {
        description: 'Rota semanal',
        active: 'TRUE',
        agentRelationship: 'SOME_AGENTS',
        activityOriginList: ['ALL_ACTIVITIES'],
        initialDate: '2026-11-05',
        recurrenceConfiguration: { repeatMode: 'WEEKLY', repeatEvery: { value: 1, unit: 'WEEK' }, weekdays: [1, 3], ends: { type: 'DATE', date: '2026-12-31' } },
        taskScheduleServiceLocals: [{ serviceLocal: { id: 3 }, treatmentOrder: 1 }],
      },
    })
    await r.taskSchedules.put(4, { description: 'Rota', initialDate: new Date(2026, 10, 5) })
    expect(last()).toEqual({ method: 'PUT', path: 'task-schedule/4', body: { description: 'Rota', initialDate: '2026-11-05' } })
    await r.taskSchedules.patch({ altId: 'PROG' }, { active: 'FALSE' })
    expect(last()).toEqual({ method: 'PATCH', path: 'task-schedule/alt-id/PROG', body: { active: 'FALSE' } })
    await r.taskSchedules.duplicate('PROG', { description: 'Cópia', alternativeIdentifier: 'PROG2', initialDate: new Date(2026, 10, 5) })
    expect(last()).toEqual({ method: 'POST', path: 'task-schedule/alt-id/PROG/duplicate', body: { description: 'Cópia', alternativeIdentifier: 'PROG2', initialDate: '2026-11-05' } })
  })

  it('taskSchedules activities/agents/teams/serviceLocals', async () => {
    await r.taskSchedules.activities.add(4, 5)
    expect(last()).toMatchObject({ method: 'POST', path: 'task-schedule/4/activity/5' })
    await r.taskSchedules.activities.remove(4, 5)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'task-schedule/4/activity/5' })
    await r.taskSchedules.agents.add({ altId: 'PROG' }, { altId: 'ana' })
    expect(last()).toMatchObject({ method: 'POST', path: 'task-schedule/alt-id/PROG/agent/alt-id/ana' })
    await r.taskSchedules.agents.remove(4, 6)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'task-schedule/4/agent/6' })
    await r.taskSchedules.teams.add(4, 7)
    expect(last()).toMatchObject({ method: 'POST', path: 'task-schedule/4/team/7' })
    await r.taskSchedules.teams.remove('PROG', 'EQ')
    expect(last()).toMatchObject({ method: 'DELETE', path: 'task-schedule/alt-id/PROG/team/alt-id/EQ' })
    await r.taskSchedules.serviceLocals.add(4, 3, { treatmentOrder: 1, initialHour: '08:00', finalHour: '10:00' })
    expect(last()).toEqual({ method: 'POST', path: 'task-schedule/4/service-local/3', body: { treatmentOrder: 1, initialHour: '08:00', finalHour: '10:00' } })
    await r.taskSchedules.serviceLocals.remove(4, 3)
    expect(last()).toMatchObject({ method: 'DELETE', path: 'task-schedule/4/service-local/3' })
    await r.taskSchedules.serviceLocals.patch({ altId: 'PROG' }, { altId: 'LOC' }, { treatmentOrder: 2 })
    expect(last()).toEqual({ method: 'PATCH', path: 'task-schedule/alt-id/PROG/service-local/alt-id/LOC', body: { treatmentOrder: 2 } })
  })

  it('geocoordinates create (normaliza date)', async () => {
    await r.geocoordinates.create({ agentId: { alternativeIdentifier: 'ana' }, latitude: -30.03, longitude: -51.23, date: new Date(2026, 10, 5), hour: '090000' })
    expect(last()).toEqual({
      method: 'POST',
      path: 'geocoordinate',
      body: { agentId: { alternativeIdentifier: 'ana' }, latitude: -30.03, longitude: -51.23, date: '2026-11-05', hour: '090000' },
    })
  })
})
