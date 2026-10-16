# Referência de recursos — @laivon/umov-sdk

Todos os recursos vivem em `new UmovClient({ apiKey })`. Operações padrão (quando presentes):
`list(filters?, {page?})` · `iterate(filters?, {hydrate?})` · `get(ref)` · `create(payload)` · `update(ref, partial)` · `upsertBatch(items, {chunked?})` · `delete(ref)`.

`ref` aceita `id` numérico ou `{ altId: '...' }` (alternativeIdentifier). Batches são **atômicos** (upsert por altId); `create` avulso com altId existente retorna erro 400 (`UmovValidationError`, `apiErrors` = `alternativeIdentifierAlreadyInUse`).

## Pessoas

| Recurso | Operações | Notas |
|---|---|---|
| `agents` | L·I·G·C·U | custom fields; imagem por `image.imageUrlImport` |
| `agentTypes` | L·I·G·C·U | |
| `teams` | L·I·G·C·U + `addMember` / `getMember` / `removeMember` | **update com `agentRelationship` substitui TODOS os membros** |
| `teamTypes` | L·I·G·C·U | |
| `sms` | `send({to, message, sendDownloadLink})` | requer Zenvia via Help Desk |

## Formulários (somente leitura — limitação da API)

`activities` · `sections` · `sectionFields` · `mathExpressions` · `logicalExpressions` — L·I·G.

## Itens

| Recurso | Operações | Notas |
|---|---|---|
| `items` | L·I·G·C·U·B(100) | `subGroup` obrigatório no create |
| `groups`, `subGroups`, `itemCategories` | L·I·G·C·U | |
| `additionalInfoItems` | L·I·G·C·U | path da API tem a grafia `aditionalInfoItem` |
| `sectionItems` | L·I·G·C·U | vincula item↔seção com order/mandatory |

## Locais

| Recurso | Operações | Notas |
|---|---|---|
| `serviceLocals` | L·I·G·C·U·B(100) | geocoordenada derivada do endereço se omitida |
| `serviceLocalTypes`, `serviceLocalClassifications`, `local3Dimensions` | L·I·G·C·U | |

## Tarefas e execução

| Recurso | Operações | Notas |
|---|---|---|
| `schedules` | L·I·G·C·U·B(**50**) + `cancel(ref)` + `route(request)` | cancel = situation 70; route = roteirizador (máx 50 tarefas, exige GPS) |
| `activityHistories` | L·I·G + `hierarchical(id)` + `createForSchedule` + `setApproval` + `setExportStatus` | lista default = últimos 7 dias sem filtro de data |
| `geoCoordinates` | L·I·G | |
| `auditing` | L·G + `values.list/get` + `hierarchical(historyId, values?)` | auditoria do device (OS, IMEI, bateria...); read-only |

## Rotas

| Recurso | Operações | Notas |
|---|---|---|
| `itineraries` | L·I·G·C·U | GET não retorna vínculos — use os recursos abaixo |
| `itineraryActivities`, `itineraryAgents`, `itineraryServiceLocals` | L·G·B(100)·D + `deleteByPair` | `treatmentOrder` obrigatório em itineraryServiceLocal |

## Vínculos

| Recurso | Operações | Notas |
|---|---|---|
| `agentActivities` | L·G·B(100) | por altIds |
| `scheduleItems` | L·G·B(100)·D + `deleteByPair({scheduleAltId, itemAltId})` | |
| `sectionSubGroups` | L·G·B(100)·D + `deleteByPair({subGroup, section})` | par aceita id ou altId |
| `serviceLocalActivities` | L·G·B(100)·D | weekdays + custom fields |

## Customizáveis

| Recurso | Operações | Notas |
|---|---|---|
| `customFields.of(entity, ref)` | `list` · `get(fieldRef)` · `setValues(values)` | **multi-valor SUBSTITUI os valores existentes**; nomes com espaço viram `__`; arrays viram pipe |
| `customEntities` | L·G (estrutura read-only) | filtro `structuralFunction` |
| `customEntities.entries(entityRef)` | L·G·C·U·B(100) | batch exige entidade por altId |
| `mix` | `types()` / `mixes()` / `items()` / `itemsOfMix(id)` | custom entities descobertas por `structuralFunction=mix` e cacheadas |

### Custom fields: o que `customFields` envia

Vale para `customFields` em qualquer payload (agents, schedules, serviceLocals...) e para `customFields.of(...).setValues`.

| Valor no objeto | O que vai no XML |
|---|---|
| `null` / `undefined` | **omitido** — o campo não é enviado e o valor existente permanece |
| `''` (string vazia) | **enviado** como `<campo></campo>` e **limpa** o campo |
| array (`['0', '1']`) | unido por pipe: `<campo>0\|1</campo>` |
| número / boolean | convertido com `String(...)` |

Atenção ao campo **multi-valor**: a API uMov **substitui** os valores existentes, não acrescenta. Enviar `''` (ou um array vazio, que vira `''`) apaga todos os valores do campo; enviar `['2']` deixa apenas `2`, descartando o que havia. Por isso um `''` vindo de um formulário ou de um mapeamento descuidado é destrutivo.

O SDK mantém `''` sendo enviado de propósito, porque limpar um campo é um uso legítimo. Quem quer "não mexer" deve passar `null`/`undefined` (ou não incluir a chave), nunca `''`.

## Mensageria

| Recurso | Operações | Notas |
|---|---|---|
| `messages` | `send({recipients, description, ...})` | máx 500 chars; entrega no próximo sync salvo `sendNotification` |
| `pushNotifications` | `send({message, agents})` | efêmera no device |

## Arquivos

| Recurso | Operações | Notas |
|---|---|---|
| `importFiles` | `schedule(names[])` | arquivos já devem estar no FTP |
| `importLayouts` | L·G + `byEntity(entity)` | read-only |
| `exportLayouts` | L·G | read-only |

## Webhook (import separado)

```ts
import { parseCallbackXml, parseCallbackJson } from '@laivon/umov-sdk/webhook'
```

Parsers puros das duas variantes do callback de tarefas. Fluxo típico: callback chega → `parseCallbackXml(body)` → `activityHistories.hierarchical(id)` → gerar laudo.

## Autenticação por credenciais

```ts
const umov = await UmovClient.fromCredentials({ login, password, domain: 'laivon' })
// ou só o token: const token = await getToken({ login, password, domain })
```

Validado contra a API real: POST /token.xml com `<apiToken><login/><password/><domain/></apiToken>` (form-encoded `data=`); o token retorna em `<result><message>`. Atenção: regenerar o token no Center invalida integrações existentes.

## Comportamentos validados contra a API real (equipes)

- `teams.addMember`: corpo `<agentTeam><agent><id/></agent><responsible/></agentTeam>` (variantes com `<agent>` cru ou `agentRelationship` retornam 400).
- `teams.getMember`: a API responde com raiz `<team>` (o time com o bloco `agentRelationship` do membro).
- `TeamCreate.teamType`: a relação só resolve por **id interno** — altId retorna `nonExistingId`.
- Sub-paths de membro (`team/{id}/agent...`) só aceitam **id interno do time** — a forma `alternativeIdentifier/` retorna 404; por isso a assinatura exige id numérico.
