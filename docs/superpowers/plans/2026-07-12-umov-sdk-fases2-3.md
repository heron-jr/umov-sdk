# @laivon/umov-sdk — Fases 2+3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o SDK: todos os cadastros, batches atômicos, vínculos com DELETE, teams+membros, rotas, mensageria (Fase 2); custom entities/mix, import/export de arquivos, webhook parsers, roteirizador (Fase 3).

**Architecture:** Mesmos padrões da Fase 1 (validados contra a API real do ambiente laivon). Novos mecanismos no core: `deletable` e `batch` no `defineResource`. Payloads irregulares (importfiles com atributo, routing, membros de team) ganham módulos próprios.

**Tech Stack:** idem Fase 1. Branch `feat/fase2-3`. TDD; commit por task.

**Fatos validados que o plano usa:** batch responde `<result><size><entries><entry id link/>` (mesmo envelope de lista → `parseListResponse` serve); create com altId duplicado → 400 (upsert SÓ via batch); update por altId responde `resourceAlternativeId`.

---

### Task 1: core — `deletable` no defineResource

`ResourceConfig.deletable?: true` adiciona `delete(ref)` → `DELETE {path}/{refToPath(ref)}.xml`. Vínculos com delete por par usam `transport.delete` direto no módulo do recurso.

Teste (`tests/core/resource.test.ts`): resource com `deletable` → `delete(9)` chama DELETE em `/widget/9.xml`; resource sem `deletable` não expõe o método (type-level).

### Task 2: core — batch atômico

`ResourceConfig.batch?: { path: string; wrapper: string; max: number }` adiciona:

```ts
upsertBatch(items: TCreate[], opts?: { chunked?: boolean }): Promise<ListStub[]>
// - valida items.length <= max (lança RangeError com mensagem clara se exceder, a menos que chunked)
// - chunked: true divide em lotes de `max` POSTados sequencialmente (cada lote é atômico à parte)
// - corpo: <{wrapper}><{rootName}>...</{rootName}>...</{wrapper}> via serializeEntity(wrapper, { [rootName]: items })
// - POST /batch/{batch.path}.xml; resposta parseada com parseListResponse → stubs criados/atualizados
```

Testes: XML do lote (2 schedules → `<schedules><schedule>..</schedule><schedule>..</schedule></schedules>`), validação de max (51 schedules → RangeError), chunked divide em 2 POSTs, resposta vira stubs.

### Task 3: cadastros simples via defineResource (Fase 2)

Wiring no client + tipos em `resources/types.ts` (padrão: `id, description, alternativeIdentifier, active` + específicos) + teste de path por recurso em `tests/client.test.ts`:

| client.<nome> | path | extras |
|---|---|---|
| `agentTypes` | `agentType` | — |
| `teamTypes` | `teamType` | — |
| `groups` | `group` | — |
| `subGroups` | `subGroup` | campo `group` (RelationRef) |
| `itemCategories` | `itemCategory` | — |
| `items` | `item` | batch `{path:'items', wrapper:'items', max:100}`; campos subGroup/itemCategory/customFields/image |
| `serviceLocalTypes` | `serviceLocalType` | — |
| `serviceLocalClassifications` | `serviceLocalClassification` | — |
| `local3Dimensions` | `local3Dimension` | — |
| `additionalInfoItems` | `aditionalInfoItem` (sic, typo da API) | campos featuredInfo/item/section/serviceLocal |
| `sectionItems` | `sectionItem` | campos order/mandatory/section/item |
| `itineraries` | `itinerary` | campos origin/agentRelation/displayOrder/exclusive/itineraryDefault |
| `mathExpressions` | `mathExpression` | read-only |
| `logicalExpressions` | `logicalExpression` | read-only |
| `importLayouts` | `importLayout` | read-only + `byEntity(entity)` → GET `importLayout/entity/{entity}.xml` (lista) |
| `exportLayouts` | `exportLayout` | read-only |

`serviceLocals` e `schedules` ganham batch: `{path:'serviceLocals', wrapper:'serviceLocals', max:100}` e `{path:'schedules', wrapper:'schedules', max:50}`.

### Task 4: teams + membros (`resources/teams.ts`)

`TeamsResource extends Resource<...>`:
- `update()` com TSDoc: **`agentRelationship` substitui TODOS os membros**.
- `addMember(teamRef, agentRef, opts?: { responsible?: boolean })` → POST `team/{ref}/agent.xml` corpo `<agent><id>N</id><responsible>bool</responsible></agent>` (schema não 100% documentado — TSDoc avisa; aceita só `{id}` numérico com segurança, altId de agent vira lookup não suportado aqui).
- `getMember(teamRef, agentId)` → GET `team/{ref}/agent/{agentId}.xml`.
- `removeMember(teamRef, agentId)` → DELETE `team/{ref}/agent/{agentId}.xml` (remove só o vínculo).

Testes: paths e corpos exatos dos três métodos.

### Task 5: vínculos com batch + delete (`resources/links.ts`)

Factory `defineLinkResource(transport, cfg)` com list/get/upsertBatch/delete e delete por par quando documentado:

| client.<nome> | path | batch (max 100) | delete por par |
|---|---|---|---|
| `agentActivities` | `agentActivity` | `batch/agentActivities.xml` | — (sem delete) |
| `scheduleItems` | `scheduleItem` | `batch/scheduleItems.xml` | DELETE `scheduleItem/schedule/{schedAltId}/item/{itemAltId}.xml` → `deleteByPair({schedule, item})` |
| `sectionSubGroups` | `sectionSubGroup` | `batch/sectionSubGroups.xml` | DELETE `sectionSubGroup/{subGroupRef}/{sectionRef}.xml` (ids ou altIds) → `deleteByPair({subGroup, section})` |
| `serviceLocalActivities` | `serviceLocalActivity` | `batch/serviceLocalActivities.xml` | só por id |
| `itineraryActivities` | `itineraryActivity` | `batch/itineraryActivities.xml` | DELETE `itineraryActivity/itinerary/{itAltId}/activity/{actAltId}.xml` |
| `itineraryAgents` | `itineraryAgent` | `batch/itineraryAgents.xml` | DELETE `itineraryAgent/itinerary/{itAltId}/agent/{agAltId}.xml` |
| `itineraryServiceLocals` | `itineraryServiceLocal` | `batch/itineraryServiceLocals.xml` | DELETE `itineraryServiceLocal/itinerary/{itAltId}/serviceLocal/{slAltId}.xml` |

Payloads tipados: agentActivity `{agent:{alternativeIdentifier}, activity:{alternativeIdentifier}}`; scheduleItem `{schedule, item, customFields?}`; serviceLocalActivity `{serviceLocal, activity, weekdays?, customFields?}`; itinerary* conforme doc (`treatmentOrder` obrigatório em itineraryServiceLocal; `comunicationType` (sic) em itineraryActivity).

Testes: um por forma de path/corpo (batch XML, delete por par com encode de altId).

### Task 6: mensageria (`resources/messaging.ts`)

- `messages.send({ sender?, recipients: string[], description, sendNotification?, hideAnswer? })` → POST `message.xml`, corpo `<message><sender><alternativeIdentifier/></sender><recipients><recipient><alternativeIdentifier/></recipient>...</recipients><description/>...</message>`; valida ≤500 chars (RangeError).
- `pushNotifications.send({ message, agents: string[] })` → POST `scheduleNotification.xml`, corpo `<scheduleNotification><message/><agents><agent><alternativeIdentifier/></agent>...</agents></scheduleNotification>`.
- `sms.send({ to: { agentId | agentAltId | serviceLocalAltId }, message, sendDownloadLink })` → POST `smsRequest.xml` (TSDoc: requer Zenvia via Help Desk).

Testes: corpos exatos dos três.

### Task 7 (F3): customEntities + entries (`resources/custom-entities.ts`)

- `customEntities.list({description?, structuralFunction?})` / `.get(ref)` (read-only — estrutura não é editável).
- `customEntities.entries(entityRef)` → sub-recurso: `list({description?, raw?})`, `get(entryRef)`, `create(payload)`, `update(entryRef, payload)`, `upsertBatch(items)` → POST `batch/customEntity/alternativeIdentifier/{entityAltId}/customEntityEntries.xml` (wrapper `customEntityEntries`; exige entityRef por altId — lança se numérico, doc só documenta a forma por altId).
- Paths de entry: `customEntity/{entityPath}/customEntityEntry[...]` com refs mistos id/altId (usa `refToPath` nos dois níveis).

Testes: paths mistos (id+altId), corpo de create com customFields `__`, batch wrapper.

### Task 8 (F3): mix (`resources/mix.ts`)

Wrapper sobre custom entities com descoberta cacheada:
```ts
umov.mix.types() / umov.mix.mixes() / umov.mix.items()  →  EntriesResource
// 1ª chamada: GET customEntity.xml?structuralFunction=mix → resolve os 3 ids de entidade
// (MIXTYPE/MIX/MIXITEM identificados pela description/structuralFunction) e cacheia no client
umov.mix.itemsOfMix(mixRecordId)  →  entries de MIXITEM filtradas por mixItem_mix
```
Teste: descoberta cacheada (2ª chamada não refaz o GET de discovery), filtro mixItem_mix na query.

### Task 9 (F3): importFiles (`resources/files.ts`)

`importFiles.schedule(names: string[])` → POST `importfiles.xml` (path minúsculo) com corpo construído à mão (atributo `name` — serializeEntity não emite atributos): `<import><files><entry name="ARQ1"/><entry name="ARQ2"/></files></import>`. Escapa aspas/`&`/`<` no nome via escape XML de atributo. TSDoc: arquivos já devem estar no FTP; múltiplos names = um pacote sequencial.

Teste: corpo exato com 2 arquivos e escape de `&` no nome.

### Task 10 (F3): webhook parsers (`src/webhook/parse.ts`, export `./webhook` no package.json)

```ts
parseCallbackXml(body: string): { scheduleAlternativeIdentifier?: string; activityHistoryIds: number[] }
parseCallbackJson(body: string | object): { historyId, taskId, clientId, activityId } // números quando numéricos
```
Testes: payload XML com 2 histories; JSON string e objeto; campos ausentes → erro claro.

### Task 11 (F3): scheduleRouting (`schedules.route()`)

```ts
umov.schedules.route({
  origin: { agent: RelationRef } | { geoCoordinate: string },
  schedules: Array<{ schedule: RelationRef; dependencies?: RelationRef[] }>,
  route?, updateSchedules?, startTime?, transportMode?, estimate?,
}): Promise<Record<string, unknown>>  // shape de resposta não documentado — retorna árvore parseada
```
Valida ≤50 tarefas (RangeError). POST `scheduleRouting.xml`. TSDoc: exige GPS válido em todas; `updateSchedules` move 'Em Preparação'→'Pendente de Envio'.

Teste: corpo exato com origin.agent + 2 schedules com dependência; validação de 51.

### Task 12: fechamento

- `docs/entities.md`: referência por recurso (gerada da tabela do client).
- README atualizado (Fases 2+3, exemplos de batch/mensageria/mix/webhook).
- `npm test` + `tsc --noEmit` + `tsup` + `npm run test:integration` (bateria real, incluindo leitura de agentTypes/customEntities novos).
- Review multi-agente adversarial → correções → merge em main.

**Fora de escopo (registrado):** `fromCredentials` (R8 — exige login/senha para validar; adiado até termos credenciais).

## Self-Review

- Cobertura da spec §5: todos os recursos da tabela têm task (Fase 2: tasks 1-6; Fase 3: 7-11). `fromCredentials` explicitamente adiado (R8).
- Sem placeholders: mecanismos novos têm contrato/corpo definidos; recursos formulaicos referenciam o padrão defineResource já implementado e testado (Fase 1), com paths/payloads exatos nas tabelas.
- Consistência: nomes `upsertBatch`/`deleteByPair`/`entries()` usados uniformemente; wrappers de batch conferidos contra docs/api-map.json.
