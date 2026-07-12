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

## Pendências conhecidas

- `fromCredentials` (POST /token.xml): adiado — schema não documentado e sem credenciais para validar (spec §7 R8).
- `teams.addMember`: schema do corpo não é 100% documentado pela uMov.me; validado apenas com id interno.
