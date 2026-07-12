# @laivon/umov-sdk — Design Spec

**Data:** 2026-07-12
**Status:** Aprovado (design validado com Heron em 2026-07-12)
**Fonte:** Documentação oficial lida na íntegra (48 páginas, https://umovme.octacx.com/s/integração-api) + padrões validados em produção no `crawler-umov`. Mapa bruto por página em [`docs/api-map.json`](../../api-map.json); síntese em [`docs/api-synthesis.json`](../../api-synthesis.json).

## 1. Objetivo

SDK TypeScript para a API CenterWeb da uMov.me (plataforma de field service). Consumidor inicial: **laivon-report** (geração de laudos/vistorias a partir de dados coletados no mobile). Deve ser **genérico** — vira lib em repositório privado próprio, consumível por qualquer projeto Laivon.

**Requisitos acordados:**
- Escopo: leitura + escrita completa (CRUD de cadastros + dados de execução).
- Multi-conta: cliente instanciável, um token por conta (`new UmovClient({ apiKey })`).
- Pacote: `@laivon/umov-sdk`, repo em `c:\Projetos\Laivon\umov-sdk`.
- O consumidor nunca vê XML: entrada/saída são objetos TypeScript tipados.

**Não-objetivos (YAGNI):**
- CLI, cache persistente, ORM/sync local, UI.
- Servidor de webhook (fornecemos apenas o *parser* do payload).
- Suporte a browser (a API exige o token na URL — segredo não pode ir ao client; Node ≥ 18 apenas).

## 2. A API uMov.me em resumo (fatos que moldam o design)

- **Base URL:** `https://api.umov.me/CenterWeb/api/{apiKey}/{recurso}.xml`. Token no path, sem headers/OAuth. 401 se inválido. Host configurável (docs citam `center.umov.me` e ambientes octacx).
- **Formato:** XML em tudo. JSON é mencionado só em 3 páginas (itinerary, itineraryAgent, scheduleItem) — tratamos XML como único formato confiável.
- **Verbos:** GET lê; **POST cria (201) e atualiza (200)** — não há PUT/PATCH. Updates são **parciais** (só os campos enviados mudam), com duas exceções que **substituem tudo**: custom fields multi-valorados e o bloco `agentRelationship` de Team. DELETE existe só em entidades de vínculo.
- **POST transport:** corpo `application/x-www-form-urlencoded` com o XML no parâmetro `data=` (padrão do crawler-umov em produção; doc é ambígua entre isso e XML cru → risco R2).
- **Identificação:** `id` interno numérico + `alternativeIdentifier` gerenciado pelo cliente, intercambiáveis via path `/alternativeIdentifier/{valor}/`. altId deve ser único (duplicado quebra lookup).
- **Listagem:** retorna stubs (`<entry id link/>`) + `<size>`; detalhe exige GET por registro (N+1). Paginação `?paging.page={n}` (1-based), máx 100/página.
- **Batch:** `/batch/{recursoPlural}.xml` — **atômico** (um erro aborta o lote inteiro), semântica de **upsert** por alternativeIdentifier. Máx 100 (schedules: 50).
- **Rate limit:** 4 req/s por IP/token → HTTP 429.
- **Escaping:** valores com caracteres especiais em CDATA; dentro de CDATA, `%`→`%25` e `&`→`%26`. Nomes de custom fields: espaço → `__`. Multi-valores: pipe (`0|1`). Datetime `YYYY-MM-DD HH:MM:SS`; em query string, espaço→`%20`, `:`→`%3A`.
- **Status codes:** 200 OK, 201 Created, 400 malformado, 401 token, 404 não encontrado, 429 rate limit, 501 entidade não habilitada para API no ambiente, 504 timeout.
- **Read-only por limitação da API:** Activity, Section, SectionField, MathExpression, LogicalExpression, CustomEntity (estrutura), ImportLayout, ExportLayout, GeoCoordinate, Auditing.
- **Exclusão de master data não existe:** desativar (`active=false`) ou cancelar schedule (POST `situation.id=70`; rejeitado se já 50/70).
- **Situações de Schedule:** 30=pendente de envio, 40=em campo, 50=executada/retornada, 70=cancelada.

## 3. Arquitetura

**Abordagem escolhida:** core genérico + recursos tipados declarativos (opção A entre 3 avaliadas; B = cliente genérico fino, rejeitada por DX fraca; C = codegen, rejeitada porque a API tem exceções demais para compensar um gerador custom).

```
umov-sdk/
├── package.json            @laivon/umov-sdk · ESM+CJS · Node >= 18
├── tsconfig.json
├── tsup.config.ts
├── src/
│   ├── index.ts            exports públicos
│   ├── client.ts           UmovClient — instancia core e recursos
│   ├── core/
│   │   ├── transport.ts    HTTP, montagem de URL, data= form-encoding, redação de token
│   │   ├── rate-limit.ts   token bucket 4 req/s + retry/backoff (429, rede, 504 em GET)
│   │   ├── xml.ts          serialize/parse (fast-xml-parser), CDATA, %25/%26, __ em nomes
│   │   ├── envelope.ts     parse de <result>: stubs de lista, resourceId de escrita
│   │   ├── errors.ts       hierarquia UmovApiError
│   │   ├── pagination.ts   iterate() auto-paginado, hydrate com concorrência limitada
│   │   ├── resource.ts     defineResource() — factory list/get/create/update/delete/batch
│   │   └── types.ts        EntityRef, ListOptions, tipos comuns
│   ├── resources/          uma definição fina por entidade (ver §5)
│   ├── webhook/parse.ts    parsers puros do callback (XML e JSON)
│   └── util/datetime.ts    format/parse do datetime da API
├── docs/
│   ├── api-map.json        extração bruta das 48 páginas da doc
│   ├── api-synthesis.json  síntese consolidada
│   └── entities.md         referência por entidade (gerada na Fase 2)
└── tests/                  vitest — unit (fetch mockado) + integration (gated por env)
```

**Dependência de runtime única:** `fast-xml-parser`. Dev: typescript, tsup, vitest, eslint.

## 4. Core — contratos

### 4.1 Cliente

```ts
const umov = new UmovClient({
  apiKey: string,                       // obrigatório; segredo
  baseUrl?: string,                     // default 'https://api.umov.me/CenterWeb/api'
  requestsPerSecond?: number,           // default 4
  maxRetries?: number,                  // default 3 (429/rede; 504 só em GET)
  timeoutMs?: number,                   // default 30_000
  fetch?: typeof fetch,                 // injetável (testes/proxy)
  logger?: (e: UmovLogEvent) => void,   // opcional; URLs SEMPRE com token redigido
})
```

Também: `UmovClient.fromCredentials({ login, password })` → obtém token via `POST /token.xml` (schema exato do body a confirmar — risco R8) e retorna cliente autenticado.

### 4.2 Endereçamento

```ts
type EntityRef = number | string | { id: number } | { altId: string }
// number → /recurso/{id}.xml
// string | {altId} → /recurso/alternativeIdentifier/{altId}.xml
```

### 4.3 Erros

`UmovApiError { status, method, url /* token redigido */, responseBody, message }` com subclasses: `UmovAuthError` (401), `UmovValidationError` (400), `UmovNotFoundError` (404), `UmovRateLimitError` (429, exposta só quando os retries se esgotam), `UmovApiNotEnabledError` (501 — mensagem orienta habilitar a entidade no Center), `UmovTimeoutError` (504). Corpo de erro XML é preservado cru em `responseBody` (formato não documentado — risco R7).

### 4.4 Leitura e paginação

```ts
umov.agents.list(filters?, { page? })          // 1 página: { entries: Stub[], size }
umov.agents.iterate(filters?)                  // AsyncGenerator<Stub> — auto-pagina
umov.agents.iterate(filters?, { hydrate: true }) // AsyncGenerator<Agent> — resolve o N+1
umov.agents.get(ref)                           // detalhe completo
```

Regra de parada da paginação: página com `size < 100` ou 0 entradas (semântica de `<size>` = tamanho da página, conforme comportamento observado no crawler; confirmar — risco R5). `hydrate` usa o próprio rate limiter como governador de concorrência.

Filtros: objeto tipado por entidade + escape hatch `raw?: Record<string, string>` para qualquer parâmetro (a API aceita campos da entidade, sintaxe pontuada `activity.description` e altId de custom field — cobertura exata não documentada, risco R13). Datas aceitam `Date` e são formatadas/encodadas automaticamente.

### 4.5 Escrita

```ts
umov.agents.create(payload)          // POST coleção → { id }
umov.agents.update(ref, partial)     // POST /{id}|/alternativeIdentifier/{altId} — parcial
umov.items.upsertBatch(items[], { chunked?: boolean })
umov.scheduleItems.delete(ref)       // só entidades de vínculo
```

- Tipos separados `XCreate` / `XUpdate` (create tem obrigatórios; update é `Partial` + altId).
- Batch valida o máximo no cliente (100/50) e lança antes de chamar; `chunked: true` divide em lotes sequenciais — **cada lote é atômico separadamente** (documentado no TSDoc).
- Métodos que substituem tudo (custom fields multi-valor, `team.update` com `agentRelationship`) ganham aviso explícito no TSDoc e nome distinto quando possível (`team.setMembers()` vs `team.addMember()`).

## 5. Recursos — inventário e operações

Legenda: L=list/iterate, G=get, C=create, U=update, B=upsertBatch, D=delete.

| Recurso | Ops | Extras específicos |
|---|---|---|
| `agents` | LGCU | custom fields; imagem via `imageUrlImport` |
| `agentTypes` | LGCU | |
| `teams` | LGCU | `addMember(teamRef, agentRef, {responsible})`, `removeMember`, `getMember`; `setMembers` substitui tudo |
| `teamTypes` | LGCU | |
| `sms` | C | `send({ to: agentRef \| serviceLocalAltId, message, sendDownloadLink })` — requer conta Zenvia |
| `activities` | LG | read-only; retorna sections/expressions como refs |
| `sections` | LG | read-only |
| `sectionFields` | LG | read-only; `type` é código de letra (mapa a documentar — risco) |
| `sectionItems` | LGCU | |
| `sectionSubGroups` | LGCUBD | delete por par `{subGroup, section}` |
| `agentActivities` | LB | vínculo agente↔atividade |
| `mathExpressions` / `logicalExpressions` | LG | read-only |
| `items` | LGCUB | custom fields; imagem |
| `groups` / `subGroups` / `itemCategories` | LGCU | paths por altId têm typos na doc — validar contra API real (R10) |
| `aditionalInfoItems` | LGCU | grafia errada é da API; preservada no path, nome público `additionalInfoItems` com alias |
| `serviceLocals` | LGCUB | geocoordenada derivada do endereço se omitida |
| `serviceLocalTypes` / `serviceLocalClassifications` / `local3Dimensions` | LGCU | |
| `serviceLocalActivities` | LBD | vínculo local↔atividade com dias da semana |
| `schedules` | LGCUB | batch máx **50**; `cancel(ref)` = POST situation.id=70; filtros por custom field |
| `scheduleItems` | LGBD | delete por id ou par `{schedule, item}` |
| `scheduleRouting` | — | `umov.schedules.route({ origin, schedules, transportMode, estimate, ... })` — máx 50 tarefas, exige GPS válido em todas |
| `itineraries` | LGCU | GET não retorna vínculos — usar entidades de vínculo |
| `itineraryActivities` / `itineraryAgents` / `itineraryServiceLocals` | LGBD | delete por id ou par de altIds; `comunicationType` (sic, typo da API) |
| `activityHistories` | LG+ | `hierarchical(id)` — árvore completa activity>sections>items>fields>geo (**base dos laudos**); `createForSchedule(scheduleRef, payload)`; `setApproval(id, 3\|4)`; `setExportStatus(id, ...)`; lista default = últimos 7 dias sem filtro de data |
| `geoCoordinates` | LG | read-only |
| `auditing` | LG | + `auditingHierarchical(historyId, values[])` |
| `customEntities` | LG | estrutura read-only; filtro `structuralFunction` |
| `customEntities.entries(entityRef)` | LGCUB | sub-recurso completo; batch upsert por altId |
| `customFields.of(entityName, ref)` | LG + set | leitura/escrita de valores em qualquer entidade; multi-valor substitui tudo |
| `mix` | LGCUB | wrapper sobre custom entities: descobre IDs por `structuralFunction=mix` na 1ª chamada e cacheia no cliente; expõe `mixTypes`, `mixes`, `mixItems` com os campos `mix_mixType`, `mixItem_mix`, `mixItem_item`, `mixItem_order` |
| `messages` | C | máx 500 chars; `sendNotification` para push imediato |
| `pushNotifications` | C | scheduleNotification — efêmera no device |
| `importFiles` | C | agenda arquivos já no FTP; path minúsculo `/importfiles.xml` |
| `importLayouts` | LG | + `byEntity(entity)` |
| `exportLayouts` | LG | |

### Webhook (fora do cliente)

```ts
import { parseCallbackXml, parseCallbackJson } from '@laivon/umov-sdk/webhook'
```

Parsers puros dos dois formatos do callback de tarefas (XML: schedule.altId + ids de histories; JSON: historyId/taskId/clientId/activityId). Uso típico no laivon-report: route handler recebe callback → `activityHistories.hierarchical(historyId)` → gera laudo.

## 6. Testes e qualidade

- **Unit (vitest):** `fetch` mockado com fixtures XML copiadas dos exemplos da doc. Cobrem: montagem de URL/refs, form-encoding `data=`, CDATA/escaping (incl. `%`/`&`/quebras de linha), envelope de lista e escrita, paginação (parada em size<100), retry em 429, redação de token em erros/logs, validação de máximos de batch.
- **Integração (opcional):** roda só com `UMOV_API_KEY` no env, contra ambiente de homologação; smoke read-only (list/get de agent, schedule, activityHistory) + os pontos ambíguos da doc (R2, R5, R6, R10).
- **Lint/typecheck:** eslint + `tsc --noEmit` no CI do repo.

## 7. Riscos e pontos a validar contra a API real

A doc tem lacunas/typos. **Validação executada em 2026-07-12 contra o ambiente `laivon`** (bateria em `tests/integration/api.itest.ts`):

| # | Ponto | Resultado |
|---|---|---|
| R1 | Host canônico (api.umov.me vs center.umov.me vs octacx) | **✅ VALIDADO**: `api.umov.me` funciona (200); token inválido → 401 |
| R2 | POST `data=` form-encoded vs XML cru | **✅ VALIDADO**: `data=` funciona para create (201) e update (200) |
| R3 | Suporte JSON parcial (.json em 3 entidades) | ignorar; XML universal |
| R4 | `paging.page` vale para todas as listas? | **✅ VALIDADO** em agent/schedule/serviceLocal/item |
| R5 | `<size>` = tamanho da página (não total) | **✅ VALIDADO**: size é da página (p1=100, p2=50 em schedule); parada em `<100` correta |
| R6 | POST em coleção com altId existente: upsert ou erro? | **✅ VALIDADO**: **erro 400** `alternativeIdentifierAlreadyInUse` — create NÃO é upsert; para upsert usar batch |
| R7 | Formato do corpo de erro XML | **✅ DESCOBERTO**: `<result><statusCode/><errors>msg;</errors><resourceName/></result>` — SDK expõe em `UmovApiError.apiErrors` |
| R8 | Schema do `POST /token.xml` | **✅ VALIDADO** (2026-07-12, credenciais do ambiente laivon): corpo `data=` form-encoded com `<apiToken><login/><password/><domain/></apiToken>`; token retorna em `<result><message>`; credencial errada → 401 `<error>` (singular). `UmovClient.fromCredentials` implementado |
| R9 | Master data sem DELETE | confirmado pela doc; SDK não expõe |
| R10 | Typos em paths (group/itemCategory/section por altId) | **✅ VALIDADO**: forma canônica `/alternativeIdentifier/{altId}.xml` funciona (group por altId 200) |

**Descoberta extra da validação**: update por altId responde `<resourceAlternativeId>` em vez de `<resourceId>` — `parseWriteResponse` aceita ambos.
| R11 | Batches além dos 12 documentados | expor só os documentados |
| R12 | 429: duração do bloqueio / Retry-After | backoff exponencial; respeitar Retry-After se vier |
| R13 | Cobertura real dos filtros de lista | filtros tipados + `raw` escape hatch |
| R14 | IDs das entidades de Mix por ambiente | descoberta runtime via `structuralFunction=mix` + cache |
| R15 | Encoding nas respostas (CDATA/%25) | decodificar simetricamente; validar |

## 8. Fases de implementação

1. **Fase 1 — núcleo + leitura para laudos** (destrava o laivon-report): core completo (§4) + `activityHistories` (com hierarchical), `schedules`, `serviceLocals`, `agents`, `activities`/`sections`/`sectionFields`, `geoCoordinates`, `customFields.of()`. Validação dos riscos R2/R4/R5/R10 contra homolog.
2. **Fase 2 — escrita e cadastros completos:** demais entidades CRUD, batches, teams/membros, itineraries + vínculos, mensageria, `fromCredentials`.
3. **Fase 3 — periféricos:** mix, import/export de arquivos, webhook parsers, scheduleRouting, `docs/entities.md` gerado.

Cada fase termina com testes verdes e review. Publicação: repo privado Laivon; consumo inicial via `npm install git+ssh://...` (ou registry privado se/quando existir).
