import { defineResource, type Resource } from '../core/resource'
import { parseDetailResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import type { Transport } from '../core/transport'
import type { SimpleEntityFilters, Team, TeamCreate, TeamUpdate } from './types'

/** Sub-paths de membro só aceitam id interno do time (a forma alternativeIdentifier/ retorna 404 — validado). */
export type TeamIdRef = number | { id: number }

export interface TeamsResource extends Resource<Team, TeamCreate, TeamUpdate, SimpleEntityFilters> {
  /**
   * Adiciona um agente à equipe sem afetar os demais membros.
   * Corpo validado contra a API real: <agentTeam><agent><id/></agent><responsible/></agentTeam>.
   */
  addMember(teamRef: TeamIdRef, agentId: number, opts?: { responsible?: boolean }): Promise<void>
  /** Retorna o time com o bloco agentRelationship do membro (a API responde com raiz <team>). */
  getMember(teamRef: TeamIdRef, agentId: number): Promise<Team>
  /** Remove apenas o vínculo — o cadastro do agente permanece. */
  removeMember(teamRef: TeamIdRef, agentId: number): Promise<void>
}

export function createTeamsResource(transport: Transport): TeamsResource {
  const base = defineResource<Team, TeamCreate, TeamUpdate, SimpleEntityFilters>(transport, { path: 'team' })
  const teamId = (ref: TeamIdRef) => (typeof ref === 'number' ? ref : ref.id)
  return {
    ...base,
    async addMember(teamRef, agentId, opts) {
      const xml = serializeEntity('agentTeam', { agent: { id: agentId }, responsible: opts?.responsible })
      await transport.post(`team/${teamId(teamRef)}/agent.xml`, xml)
    },
    async getMember(teamRef, agentId) {
      return parseDetailResponse<Team>(await transport.get(`team/${teamId(teamRef)}/agent/${agentId}.xml`), 'team')
    },
    async removeMember(teamRef, agentId) {
      await transport.delete(`team/${teamId(teamRef)}/agent/${agentId}.xml`)
    },
  }
}
