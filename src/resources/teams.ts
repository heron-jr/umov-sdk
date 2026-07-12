import { defineResource, type Resource } from '../core/resource'
import { parseDetailResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { refToPath, type EntityRef } from '../core/types'
import type { Transport } from '../core/transport'
import type { Agent, SimpleEntityFilters, Team, TeamCreate, TeamUpdate } from './types'

export interface TeamsResource extends Resource<Team, TeamCreate, TeamUpdate, SimpleEntityFilters> {
  /**
   * Adiciona um agente à equipe sem afetar os demais membros.
   * (Schema do corpo não é 100% documentado pela uMov.me — validado apenas com id interno do agente.)
   */
  addMember(teamRef: EntityRef, agentId: number, opts?: { responsible?: boolean }): Promise<void>
  getMember(teamRef: EntityRef, agentId: number): Promise<Agent>
  /** Remove apenas o vínculo — o cadastro do agente permanece. */
  removeMember(teamRef: EntityRef, agentId: number): Promise<void>
}

export function createTeamsResource(transport: Transport): TeamsResource {
  const base = defineResource<Team, TeamCreate, TeamUpdate, SimpleEntityFilters>(transport, { path: 'team' })
  return {
    ...base,
    async addMember(teamRef, agentId, opts) {
      const xml = serializeEntity('agent', { id: agentId, responsible: opts?.responsible })
      await transport.post(`team/${refToPath(teamRef)}/agent.xml`, xml)
    },
    async getMember(teamRef, agentId) {
      return parseDetailResponse<Agent>(await transport.get(`team/${refToPath(teamRef)}/agent/${agentId}.xml`), 'agent')
    },
    async removeMember(teamRef, agentId) {
      await transport.delete(`team/${refToPath(teamRef)}/agent/${agentId}.xml`)
    },
  }
}
