# API uMov.me 2.0 (JSON) — conhecimento consolidado

Fonte: https://developers.umov.me/api/v2/ (texto) + spec OpenAPI 2.0 pública em
`https://api.umov.me/v2/v2/api-docs` (cópia em [api-v2-openapi.json](api-v2-openapi.json), 302 operações, 82 schemas).
Consolidado em 2026-10-29. Também lidos: API Routing, Autenticação integrada com terceiro, Importer v2 e Banco de Consulta (links externos do menu).

## 1. Fatos que moldam o design

| | v1 (CenterWeb XML) | v2 (JSON) |
|---|---|---|
| Base URL | `https://api.umov.me/CenterWeb/api/{apiKey}/…` | `https://api.umov.me/v2/…` |
| Auth | token na **URL** | headers **`AppId`** + **`AppKey`** |
| Formato | XML (`data=` form-encoded) | `Content-Type: application/json` |
| Verbos | GET / POST (cria **e** atualiza) / DELETE | POST (cria) / **PUT** (total) / **PATCH** (parcial) / DELETE |
| Leitura | sim (list paginado + get) | **NÃO EXISTE nenhum GET** — a v2 é só escrita |
| Endereçamento | `/{id}.xml` ou `/alternativeIdentifier/{altId}.xml` | `/{id}` ou `/alt-id/{altId}` |
| Envelope resposta | `<result><resourceId/>…` | `ApiReturn { code, id, operationMessages[{key,value}] }` |
| Erros | HTTP + `<errors>` texto | HTTP 400/401/404 + `operationMessages[].key` (chave estável, mensagem traduzida) |

**Consequência central:** v1 e v2 são complementares, não concorrentes. Fluxo natural = **ler pela v1, escrever pela v2**
(PATCH parcial real, DELETE físico, vínculos por sub-rota, recursos novos). Quem só tem apiKey continua 100% na v1.

## 2. Autenticação

- `AppId`: inteiro, único por ambiente (ex.: `2`).
- `AppKey`: UUID-like (ex.: `c055666b-21f8-44d7-222e-5d564a8788c`). A doc diz "token expirável", mas **não há endpoint de
  renovação nem campo de validade** na spec — hoje criação/expiração é manual via suporte uMov.me. Tratar como
  credencial estática; 401 (`ApiUnauthorizedResponse`) = chave inválida/expirada → regenerar via suporte.
- Não há `securityDefinitions` na spec: os dois headers aparecem como parâmetros obrigatórios em todas as 302 operações.
- Routing API (`https://routingmachine.umov.me`) usa **outro** esquema: `Authorization: Bearer <token>` (OAuth2-style), token único por ambiente.

## 3. Convenções de payload

- **Referência a outro recurso** (`Entidade de relacionamento`): `{ id }` **ou** `{ alternativeIdentifier }` — mesmo shape do `RelationRef` v1.
- **Custom fields** (`Campo customizável`): array, não mapa:
  `customFields: [{ alternativeIdentifier, value }]` · lista: `{ alternativeIdentifier, internalValue, externalValue }` ·
  multivalorado: `{ alternativeIdentifier, values: [{ internalValue, externalValue, value }] }`.
  Erros: `custom_field.duplicated` (lista simples repetida), `custom_field_multivalued.duplicatedInternalValue`.
- **Booleanos**: alguns DTOs usam `boolean` (agent, item, team, task…), outros usam enum string `"TRUE"|"FALSE"`
  (activityType, activity, section, sectionField, tag, systemParameters, taskSchedule.active). Respeitar por DTO.
- **Datas**: `yyyy-MM-dd`; **horas** `HH:mm`; geocoordinate `hour` é `HHmmss`; `dateHour` `yyyy-MM-dd HH:mm[:ss]` (ISO com `T` NÃO é aceito); absence usa `date-time` ISO.
- **Imagem** (`Dados de uma imagem`): `{ id }` de mídia existente **ou** `{ url }` para importar (`image.url.required` se nenhum).
- **Endereço**: `address.geoCoordinate: "-30.044,-51.173"`; local tem `processGeocoordinate` (sync/async).
- `PUT` = substituição total, `PATCH` = só os campos enviados. Criação **não** deve mandar `id` (`more_than_one_resource:id=…`).

## 4. Resposta e erros

```json
{ "code": 200, "id": "123456", "operationMessages": [{ "key": "resource_created", "value": "…" }] }
```
- Sucesso: `id` do recurso criado/afetado (string na spec; numérica na prática para a maioria).
- 400 `ApiReturn` com `operationMessages[].key` = **chave de negócio estável** (usar a chave, não a mensagem, que varia por idioma).
  Sufixo após `:` contextualiza: `resource_not_found:alternativeIdentifier=agente-01`, `field_required:accessRole`.
- 401 `ApiUnauthorizedResponse`, 404 `ApiNotFoundResponse` (mesmo shape).
- Chaves comuns a todos os recursos: `empty_keys`, `resource_not_found`, `internal_identifier_not_found`,
  `more_than_one_resource`, `field_required`, `max_size`, `invalid`, `duplicated`, `error.requestTimeOut`, `persistence_error`,
  família `custom_field.*` / `customFieldValue.*` / `customField.*`, `image.*` / `media.image.not_found`.
- Rate limit: não documentado para a v2. Assumir o mesmo 4 req/s por credencial até prova em contrário.

## 5. Inventário de recursos (path → operações)

Legenda: C=POST cria · U=PUT total · P=PATCH parcial · D=DELETE · `{ref}` = `/{id}` e `/alt-id/{altId}`.

### Pessoas
- `/agents` C · `{ref}` U P · `{ref}/activity/{ref}` C D (vincular/desvincular atividade).
- `/agentType` C · `{ref}` U P D.
- `/team` C · `{ref}` P · `{ref}/agent/{ref}` C U P D (body `{ teamResponsible }`) · `/alt-id/{alt}/agent` C (body `{ alternativeIdentifier, teamResponsible }`) · `{ref}/agents` D (remove todos) · `{ref}/local/{ref}` C D.
- `/absence` C · `{ref}` U P — ausência programada (`action`: 0 ignora agenda / 1 transfere / 2 bloqueia login; `originAgent`, `destinationAgent`, `initialDateTime`, `finalDateTime`).
- `/workJourney` C · `{ref}` P D · `/alt-id/{alt}/work-days` C U · `/alt-id/{alt}/work-days/{MONDAY…SUNDAY}` D. `/workDayJourney` C · `/{id}` P D.
- `/password-policies` C · `/{id}` U D.

### Formulários (atividades) — **v2 permite escrever, v1 só lê**
- `/activities` C · `{ref}` P · `/alt-id/{alt}` D · `/copy` C · `/default` C D ·
  `/{id}/ancestors` U(lista) P(add) · `/{id}/ancestors/{ancestorId}` D · idem `/impediments` ·
  `/{id}/sections` C · `/{id}/sections/{sid}` P · `…/sections/{sid}/fields` C · `…/fields/{fid}` P ·
  `…/sections/{sid}/items/{iid}` C D · `…/sections/{sid}/subgroups/{sgid}` C D (todos com variante alt-id).
- `/activityType` C · `{ref}` P D.
- `/formulas/valor/{tipo}` e `/formulas/validacao/{tipo}` C · `/{formulaId}` P D.

### Itens
- `/item` C · `PUT /item` (upsert) · `{ref}` U P.
- `/subgroup` C · `{ref}` U P.
- `/aditional-info-items` C · `/{id}` U (grafia da API).

### Locais
- `/locals` C (**também `/local`**, mesmo contrato) · `{ref}` U P · `{ref}/activity/{ref}` C D P · `{ref}/item/{ref}` C D · `{ref}/item/{ref}/custom-field/{ref}` P · `{ref}/tag/{ref}` C D P.
- `/localTypes` C · `{ref}` P D. `/localGroups/{id}` D. `/localClassifications/{id}` D.

### Tarefas
- `/tasks` C (**também `/task`**, mesmo contrato) · `{ref}` U P · `{ref}/activity/{ref}` C D P · `{ref}/item/{ref}` C U D P ·
  `/history` C (`AddHistoryCommand { taskAlternativeIdentifier, activityAlternativeIdentifier, fields:[{fieldAlternativeIdentifier,value}] }`) ·
  `/prioritize` PATCH (array `[{ id, priority, initialDate, initialHour, finalDate, finalHour }]`) ·
  `/recede` C (`{id}|{ids}|{alternativeIdentifier}|{alternativeIdentifiers}`; 40→30, 30→20, 70→30) ·
  `/transfer` C (`{ taskIds|taskAlternativeIdentifiers, destinationAgentId|destinationAgentAlternativeIdentifier, initialDate }`) ·
  `/copy` C (`{ id | alternativeIdentifier }`).
  Situações: 20 preparação, 30 pendente, 40 em campo, 50 retornada, 70 cancelada (`situationId` ou `taskStatus:{id}`).
  `teamExecutionId` obrigatório se `team` informado. Observação ≤ 500 chars.
- `/taskType` C · `{ref}` U P D · `{ref}/activity/{ref}` C D · `{ref}/activities` D · `/taskTypeActivity` C · `/taskTypeActivity/{id}` D.
- `/task-schedule` (programação recorrente) C · `{ref}` U P · `{ref}/duplicate` C · `{ref}/activity|agent|team/{ref}` C D · `{ref}/service-local/{ref}` C D P.
- `/geocoordinate` C (só criação; `agentId` ref, `latitude`, `longitude` obrigatórios).

### Rotas
- `/itinerary` C · `{ref}` U P D · `/duplicate` C · `{ref}/activity|agent|team/{ref}` C D · `{ref}/service-local/{ref}` C D P (body opcional `{ treatmentOrder, initialHour, finalHour }`).

### Customizáveis
- `/custom-entity` C · `{ref}` U P. `/internal/custom-entities/delete-all` D (body `{ customEntityAltIds }`, só se vazio).
- `/custom-entity-entry` C · `PUT /custom-entity-entry` · `{ref}` U P D · `/mixItem/{mixId}/{itemId}` D.
  Entry: `{ customEntityAltId | customEntityId, alternativeIdentifier, description, active, customFields[] }`.
- `/customField/entity/{AGENT|CUSTOM_ENTITY|ITEM|LOCAL_ACTIVITY|LOCAL_ITEM|SERVICE_LOCAL|TASK|TASK_ITEM}` C · `…/alt-id/{alt}` P.
  `typeField`: ALPHANUMERIC, CUSTOM_ENTITY_LIST, DATE, GEOCOORDINATE, MULTIMEDIA, MULTIVALUED, NUMERIC, PAYMENT_RECIEVER (sic), TIME; `subtypeField` para MULTIMEDIA (MULTIMIDIA_*) e listas (SIMPLE_LIST/MULTIPLE_LIST). `description`, `size`, `typeField` obrigatórios.
- `/tags` C · `{ref}` P (`entity` obrigatório: AGENT, CUSTOM_ENTITY, ITEM, LOCAL_ACTIVITY, LOCAL_ITEM, SERVICE_LOCAL, TASK, TASK_ITEM).

### Plataforma / admin (fora do escopo do SDK por ora)
- `/media` C (**multipart/form-data**: file, description, type) · `/media/tags` C.
- `/systemParameters` P · `/appearances` P (white label) · `/feature-toggle/*` · `/password-policies`.

## 6. Routing API (serviço separado)

Base `https://routingmachine.umov.me`, `Authorization: Bearer`. `POST /route` (síncrono), `POST /routeAsync` + `GET /routeAsync/{identifier}`,
`POST /directions`, `POST /routePlan`, `POST /task/distribution`. Spec em `routingmachine.umov.me/v2/api-docs`. Não coberto pelo SDK.

## 7. Autenticação integrada com terceiro (não é consumo de API)

A plataforma chama **o seu** endpoint HTTPS (`POST`, `application/xml`, timeout 10s) com
`<authenticationRequest><login/><password/><domain/><module/></authenticationRequest>` e espera
`<authenticationResponse><statusCode>200</statusCode><credentials><login/><name/><alternativeIdentifier/><role/></credentials></authenticationResponse>`
ou `statusCode 401` + `<message>`. Cria o agente automaticamente no primeiro login se não existir. Configuração via suporte.
