# @laivon/umov-sdk — Suporte à API 2.0 (JSON) — Design Spec

Data: 2026-10-29. Base de conhecimento: [docs/api-v2.md](../../api-v2.md) e [docs/api-v2-openapi.json](../../api-v2-openapi.json).

## 1. Objetivo

Adicionar ao SDK a API 2.0 da uMov.me (JSON, headers `AppId`/`AppKey`) **sem alterar o comportamento de quem usa só a v1**.
O consumidor escolhe: só v1 (como hoje), só v2, ou as duas no mesmo cliente. Cobertura: **todas as 302 operações** da spec.

## 2. Fatos da API que moldam o design

- A v2 **não tem GET**: é exclusivamente escrita (POST cria, PUT total, PATCH parcial, DELETE). Leitura continua na v1.
- Auth por headers `AppId` + `AppKey` (chave estática; sem endpoint de renovação na spec). Routing API usa Bearer — fora de escopo.
- Endereçamento `/{id}` ou `/alt-id/{altId}`; vínculos exigem o **mesmo tipo** de referência nos dois lados
  (`/tasks/{id}/activity/{id}` ou `/tasks/alt-id/{a}/activity/alt-id/{b}`), exceto `team/alt-id/{t}/agent/{agentAltId}`.
- Envelope único de resposta `{ code, id, operationMessages:[{key,value}] }`; erros 400/401/404 no mesmo shape com chaves estáveis.
- Custom fields são array `[{ alternativeIdentifier|id, value | internalValue+externalValue | values[] }]`.
- Booleanos ora `boolean`, ora enum `"TRUE"|"FALSE"` — respeitado por DTO nos tipos.

## 3. Superfície pública

```ts
new UmovClient({ apiKey })                                  // v1 apenas — inalterado
new UmovClient({ v2: { appId: 2, appKey: '…' } })           // v2 apenas
new UmovClient({ apiKey, v2: { appId, appKey } })           // ambos: lê pela v1, escreve pela v2
umov.agents.list()                                          // v1
umov.v2.agents.create({ name, login, … })                   // v2 → { id, messages }
umov.v2.tasks.patch({ altId: 'OS-1' }, { priority: 0 })
umov.v2.tasks.activities.add({ altId: 'OS-1' }, { altId: 'VISTORIA' })
new UmovV2Client({ appId, appKey })                         // cliente v2 avulso (mesma instância usada por umov.v2)
```

- `UmovClientOptions` passa a ser `Omit<TransportOptions,'apiKey'> & { apiKey?: string; v2?: UmovV2Options }`.
  O construtor exige `apiKey` **ou** `v2`; sem nenhum, lança (teste atual `exige apiKey` continua válido).
- Sem `apiKey`, os recursos v1 existem mas qualquer chamada lança `UmovConfigError('apiKey (v1) não configurada')` no
  `Transport.request` — erro claro no primeiro uso, sem quebrar a construção.
- `umov.v2` é um getter: devolve o `UmovV2Client` ou lança `UmovConfigError('credenciais v2 (appId/appKey) não configuradas')`.
- `UmovV2Options = { appId: number|string; appKey: string; baseUrl?; requestsPerSecond?; maxRetries?; timeoutMs?; retryBaseMs?; maxRetryDelayMs?; fetch?; logger? }` (default `https://api.umov.me/v2`, 4 req/s, mesmos defaults do v1).
  `fetch`/`logger` omitidos em `v2` herdam os do nível raiz do `UmovClient`.
- `UmovClient.fromCredentials` continua só v1 (não existe troca de login por AppKey).

## 4. Core v2 (`src/v2/`)

### 4.1 `transport.ts` — `TransportV2`
- `request(method, path, body?)` → `Promise<V2Result>`; métodos `post/put/patch/delete`.
- Headers: `AppId`, `AppKey`, `Accept: application/json`, `Content-Type: application/json` quando há body. Body = `JSON.stringify` com `undefined` omitido (comportamento nativo).
- `RateLimiter` próprio (reutiliza `core/rate-limit.ts`), separado do v1.
- Retry/backoff igual ao v1: 429 sempre (respeita `Retry-After`, teto `maxRetryDelayMs`); 504 e falha de rede só em
  métodos idempotentes (PUT, PATCH, DELETE). POST nunca é retentado após envio.
- Redação: `AppKey` substituída por `***` em URL/corpo de erro/logs (a chave não vai na URL, mas a redação é defensiva; `AppId` não é segredo).
- Resposta: `text` vazio → `{ code: status, messages: [] }`; JSON inválido → `{ code: status, messages: [], raw: text }`.
  `V2Result = { code: number; id?: number; rawId?: string; messages: V2Message[]; raw?: string }` — `id` só quando `rawId` é numérico.
- Logger: reutiliza `UmovLogEvent` (`type: request|retry|error|warning`), com `url` já redigida.

### 4.2 Erros — mudança mínima em `core/errors.ts`
- `UmovErrorContext` ganha `messages?: V2Message[]`. `UmovApiError` ganha `readonly messages: V2Message[]` (vazio na v1),
  `readonly keys: string[]` e `hasKey(prefix: string): boolean` (match exato ou `prefix + ':'`).
- Na v2, `apiErrors` = chaves unidas por `; ` para a mensagem continuar legível. As subclasses por status
  (`UmovValidationError` 400, `UmovAuthError` 401, `UmovNotFoundError` 404, `UmovRateLimitError` 429, `UmovTimeoutError` 504)
  são **as mesmas** para v1 e v2 — `instanceof` funciona nas duas.
- Nova `UmovConfigError extends Error` (credencial ausente, referência mista em vínculo).

### 4.3 `resource.ts` — builders
- `refToV2Path(ref: EntityRef)`: `number|{id}` → `"{id}"`; `string|{altId}` → `"alt-id/{encodeURIComponent(altId)}"`.
- `isAltRef(ref)`. Vínculos checam que os dois refs são do mesmo tipo; senão `UmovConfigError`.
- Builders compostos pelos módulos de recurso (cada um devolve uma função):
  - `v2Create<T>(transport, path)` → `(payload: T) => Promise<V2Result>` (POST `/path`)
  - `v2Put<T>(transport, path)` / `v2Patch<T>(transport, path)` → `(ref, payload) => Promise<V2Result>` (`/path/{ref}`)
  - `v2Delete(transport, path)` → `(ref) => Promise<V2Result>`
  - `v2Link<TBody>(transport, path, sub, ops)` → `{ add(ref, subRef, body?), remove(ref, subRef), put?, patch? }` em `/path/{ref}/{sub}/{subRef}`
  - `v2Action<T>(transport, method, path)` → `(payload: T) => Promise<V2Result>` para ações sem ref (`/tasks/transfer`, `/itinerary/duplicate`…).
- Normalização de datas: campos documentados como `yyyy-MM-dd` aceitam `Date | string` e passam por `formatDate` no módulo
  (tasks, taskSchedules, itineraries, prioritize, transfer). Demais formatos (`HH:mm`, `HHmmss`, date-time) são `string`.

### 4.4 Tipos compartilhados (`src/v2/types.ts`)
- `V2Ref = { id: number } | { alternativeIdentifier: string }` (alias de `RelationRef`), `V2Image = { id?: string; url?: string }`,
  `V2Bool = 'TRUE' | 'FALSE'`, `V2CustomField`, `V2CustomFieldValue`, `V2Message`, `V2Result`, `V2PhoneContact`, `V2Contact`, endereços.
- Helper `customFieldsFromMap(map: Record<string, string | string[]>): V2CustomField[]` — ponte para quem já usa o estilo v1
  (`string` → `{ alternativeIdentifier, value }`; `string[]` → `{ alternativeIdentifier, values: [{ internalValue }] }`).
- DTOs por domínio vivem no módulo do recurso (`Pick`/`Partial` para create vs patch quando a spec diferencia).

## 5. Recursos (`src/v2/resources/*.ts`) — mapeamento completo

Notação: C=create (POST), U=put, P=patch, D=delete, por `EntityRef` salvo indicação. Sub-objetos = `v2Link`.

| Módulo | Recurso em `umov.v2` | Operações |
|---|---|---|
| agents.ts | `agents` | C U P · `activities.add/remove` |
| | `agentTypes` | C U P D |
| | `absences` | C U P |
| | `workJourneys` | C P D · `workDays.create/put(altId, body)` · `workDays.remove(altId, 'MONDAY'…)` |
| | `workDayJourneys` | C · P D (só id) |
| | `passwordPolicies` | C · U D (só id; path `/password-policies`) |
| teams.ts | `teams` | C P · `agents.add(ref, agentRef, {teamResponsible?})` (`/team/{id}/agent/{id}` ou `/team/alt-id/{t}/agent/{agentAlt}`) · `agents.put/patch/remove` · `agents.removeAll(ref)` · `agents.addByAltId(teamAlt, {alternativeIdentifier, teamResponsible})` · `locals.add/remove` |
| items.ts | `items` | C · `upsert(payload)` (PUT `/item`) · U P |
| | `subGroups` | C U P |
| | `additionalInfoItems` | C · U (só id; path `/aditional-info-items`) |
| locals.ts | `locals` | C U P · `activities.add/remove/patch` · `items.add/remove` · `items.patchCustomField(localRef, itemRef, fieldRef, body)` · `tags.add/remove/patch` |
| | `localTypes` | C P D |
| | `localGroups` | D (id) · `localClassifications` D (id) |
| | `tags` | C P |
| tasks.ts | `tasks` | C U P · `activities.add/remove/patch` · `items.add/put/remove/patch` · `history(cmd)` · `prioritize(items[])` · `recede(sel)` · `transfer(dto)` · `copy(ref)` |
| | `taskTypes` | C U P D · `activities.add/remove` · `activities.removeAll(ref)` · `linkActivity(body)` / `unlinkActivity(id)` (`/taskTypeActivity`) |
| | `taskSchedules` | C U P · `duplicate(ref, body)` · `activities/agents/teams.add/remove` · `serviceLocals.add/remove/patch` |
| | `geocoordinates` | C |
| activities.ts | `activities` | C P · `remove(altId)` (só alt-id) · `copy(body)` · `setDefault(body)` / `unsetDefault(body)` · `ancestors.replace(id, list)/add(id, item)/remove(id, ancestorId)` · idem `impediments` · `sections.create(actRef, body)` · `sections.patch(actRef, secRef, body)` · `sections.fields.create/patch` · `sections.items.add/remove` · `sections.subGroups.add/remove` |
| | `activityTypes` | C P D |
| | `formulas` | `value.create(tipo, body)/patch(tipo, id, body)/remove(tipo, id)` · `validation.*` idem |
| custom.ts | `customEntities` | C U P · `deleteAll({ customEntityAltIds })` |
| | `customEntityEntries` | C · `upsert(body)` (PUT sem ref) · U P D · `removeMixItem(mixId, itemId)` |
| | `customFields` | `create(entity, body)` · `patch(entity, altId, body)` (`entity` = `V2CustomFieldEntity` enum) |
| itineraries.ts | `itineraries` | C U P D · `duplicate(body)` · `activities/agents/teams.add/remove` · `serviceLocals.add/remove/patch` |
| platform.ts | `media` | `upload({ file: Blob, filename, description?, type? })` (multipart via `FormData`) · `tags(body)` |
| | `systemParameters` | `patch(body)` · `appearances.patch(body)` |
| | `featureToggles` | C · P(id) · `client.add/remove(featureId, clientId)` · `agent.add/remove(featureId, clientId, agentId)` · `global.add/remove(featureId)` · `partner.add/remove(featureId, partnerId)` |

Paths duplicados na spec (`/local` e `/locals`, `/task` e `/tasks`, `/api/aditional-info-items`, `/api/password-policies`): o SDK usa a forma plural/sem `/api` (`/locals`, `/tasks`, `/aditional-info-items`, `/password-policies`). Sub-rotas seguem o mesmo prefixo.

## 6. Testes

- `tests/v2/transport.test.ts`: headers, JSON body, parse do envelope (id numérico/string/vazio), retry 429 com Retry-After,
  504 retenta PATCH e não POST, erro 400 vira `UmovValidationError` com `messages`/`hasKey`, redação da AppKey.
- `tests/v2/resource.test.ts`: `refToV2Path`, mistura id/altId em vínculo lança `UmovConfigError`, `customFieldsFromMap`.
- `tests/v2/client.test.ts`: `UmovClient` só v1 inalterado; só v2 → v1 lança `UmovConfigError` no uso; ambos; `umov.v2` sem credencial lança.
- `tests/v2/resources/*.test.ts`: por módulo, um teste por operação checando método + path + body (fetch mock), inclusive
  normalização de datas e os casos especiais (`team/alt-id/{t}/agent/{agentAlt}`, formulas `{tipo}`, media multipart).
- `tests/integration/api-v2.itest.ts`: `describe.skipIf(!UMOV_APP_ID || !UMOV_APP_KEY)`; cria/atualiza/remove um `agentType`
  marcado como teste e verifica 400 com chave estável em payload inválido.

## 7. Documentação e entrega

- README: seção "API 2.0 (JSON)" com as três formas de construir o cliente e o padrão "lê v1 / escreve v2".
- `docs/entities.md`: seção "v2" com a tabela da §5.
- `docs/api-v2.md` já consolida a API; `src/v2/` referencia as seções relevantes nos comentários.
- `src/index.ts` exporta `UmovV2Client`, `UmovV2Options`, `UmovConfigError`, `customFieldsFromMap` e todos os tipos v2.
- Sem bump de versão nesta entrega (fica para o `chore(release)`).

## 8. Fora de escopo

Routing API (host e auth distintos), Importer v2 e Banco de Consulta (produtos externos), leitura via v2 (não existe).
