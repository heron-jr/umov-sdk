import type { EntityRef } from '../../core/types'
import { assertSameRefKind, isAltRef, refToV2Path, refValue, v2Create, v2Link, v2Patch, type V2CreateFn, type V2WriteFn } from '../resource'
import type { TransportV2 } from '../transport'
import type { V2Ref, V2Result } from '../types'

// ---------- DTOs (docs/api-v2-openapi.json#/definitions) ----------

/** `Informações de relacionamento de um agente a equipe` — item de `agentRelationship` e body de POST /team/alt-id/{alt}/agent. */
export interface V2TeamAgentRelationship {
  /** Identificador alternativo do agente. */
  alternativeIdentifier: string
  teamResponsible?: boolean
}

/** `Data object de dados da equipe` — POST /team, PATCH /team/{ref}. `description` obrigatório na criação. */
export interface V2Team {
  description?: string
  alternativeIdentifier?: string
  active?: boolean
  /** Vincula agentes pelo altId (a spec só documenta `alternativeIdentifier`). */
  agentRelationship?: V2TeamAgentRelationship[]
  /** Equipe responsável por esta equipe. */
  teamResponsible?: V2Ref
  teamType?: V2Ref
}

/** `TeamResponsibleDTO` — body do vínculo equipe × agente. */
export interface V2TeamResponsible {
  teamResponsible?: boolean
}

// ---------- Recursos ----------

export interface V2TeamsResource {
  create: V2CreateFn<V2Team>
  patch: V2WriteFn<V2Team>
  /**
   * Vínculo equipe × agente — refs do mesmo tipo (id/id ou altId/altId).
   * Por altId a API usa `/team/alt-id/{t}/agent/{a}` (agente SEM `alt-id/`) em POST/PUT/PATCH
   * e `/team/alt-id/{t}/agent/alt-id/{a}` no DELETE; por id é sempre `/team/{id}/agent/{id}`.
   */
  agents: {
    add(teamRef: EntityRef, agentRef: EntityRef, body?: V2TeamResponsible): Promise<V2Result>
    put(teamRef: EntityRef, agentRef: EntityRef, body: V2TeamResponsible): Promise<V2Result>
    patch(teamRef: EntityRef, agentRef: EntityRef, body: V2TeamResponsible): Promise<V2Result>
    remove(teamRef: EntityRef, agentRef: EntityRef): Promise<V2Result>
    /** POST `/team/alt-id/{teamAlt}/agent` — agente identificado no body. */
    addByAltId(teamAltId: string, body: V2TeamAgentRelationship): Promise<V2Result>
    /** DELETE `/team/{ref}/agents` — desvincula todos os agentes. */
    removeAll(teamRef: EntityRef): Promise<V2Result>
  }
  /** `/team/{ref}/local/{ref}` — refs do mesmo tipo. */
  locals: {
    add(teamRef: EntityRef, localRef: EntityRef): Promise<V2Result>
    remove(teamRef: EntityRef, localRef: EntityRef): Promise<V2Result>
  }
}

export interface V2TeamResources {
  teams: V2TeamsResource
}

export function createTeamResources(t: TransportV2): V2TeamResources {
  const teamLocals = v2Link(t, 'team', 'local')
  // POST/PUT/PATCH: por altId o agente vai sem o prefixo `alt-id/`.
  const writePath = (teamRef: EntityRef, agentRef: EntityRef) => {
    assertSameRefKind(teamRef, agentRef, 'team/agent')
    const agent = isAltRef(agentRef) ? encodeURIComponent(refValue(agentRef)) : refToV2Path(agentRef)
    return `team/${refToV2Path(teamRef)}/agent/${agent}`
  }
  // DELETE: forma regular, com `alt-id/` dos dois lados.
  const deletePath = (teamRef: EntityRef, agentRef: EntityRef) => {
    assertSameRefKind(teamRef, agentRef, 'team/agent')
    return `team/${refToV2Path(teamRef)}/agent/${refToV2Path(agentRef)}`
  }
  // async para que a validação de refs rejeite a promise em vez de lançar síncrono
  return {
    teams: {
      create: v2Create(t, 'team'),
      patch: v2Patch(t, 'team'),
      agents: {
        add: async (teamRef, agentRef, body) => t.post(writePath(teamRef, agentRef), body),
        put: async (teamRef, agentRef, body) => t.put(writePath(teamRef, agentRef), body),
        patch: async (teamRef, agentRef, body) => t.patch(writePath(teamRef, agentRef), body),
        remove: async (teamRef, agentRef) => t.delete(deletePath(teamRef, agentRef)),
        addByAltId: (teamAltId, body) => t.post(`team/${refToV2Path({ altId: teamAltId })}/agent`, body),
        removeAll: (teamRef) => t.delete(`team/${refToV2Path(teamRef)}/agents`),
      },
      locals: { add: (a, b) => teamLocals.add(a, b), remove: teamLocals.remove },
    },
  }
}
