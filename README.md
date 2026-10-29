# @laivon/umov-sdk

SDK TypeScript para a API CenterWeb da [uMov.me](https://www.umov.me). Node ≥ 18. XML 100% interno — você fala objetos tipados.

## Instalação

```bash
npm install git+https://github.com/heron-jr/umov-sdk.git
# ou via SSH:
npm install git+ssh://git@github.com/heron-jr/umov-sdk.git
```

O `prepare` script compila o `dist/` na instalação via git.

## Uso

```ts
import { UmovClient } from '@laivon/umov-sdk'

const umov = new UmovClient({ apiKey: process.env.UMOV_API_KEY! })
// ou por credenciais do Center (POST /token.xml):
// const umov = await UmovClient.fromCredentials({ login, password, domain: 'seu-ambiente' })

// Listagem auto-paginada com hidratação (resolve o N+1 da API)
for await (const schedule of umov.schedules.iterate({ situation: 50 }, { hydrate: true })) {
  console.log(schedule.id, schedule.date)
}

// Detalhe por id interno ou alternativeIdentifier
const agent = await umov.agents.get({ altId: 'TEC-042' })

// Árvore completa de execução (base para laudos)
const laudo = await umov.activityHistories.hierarchical(12345)

// Escrita: create retorna { id }; update é parcial
const { id } = await umov.schedules.create({
  agent: { alternativeIdentifier: 'TEC-042' },
  serviceLocal: { alternativeIdentifier: 'LOJA-9' },
  date: new Date('2026-08-01'),
  hour: '09:00',
})
await umov.schedules.cancel({ altId: 'OS-123' })

// Custom fields de qualquer entidade (multi-valor SUBSTITUI os valores existentes)
await umov.customFields.of('agent', { altId: 'TEC-042' }).setValues({ regioes: ['0', '1'] })
```

## Recursos

Cobertura completa da API (Fases 1–3): pessoas, formulários, itens, locais, tarefas, rotas, vínculos com batch atômico, custom entities/fields, mix, mensageria, import/export de arquivos, roteirizador e parsers de webhook. Referência completa por recurso: [docs/entities.md](docs/entities.md).

```ts
// Batch atômico (upsert por alternativeIdentifier) — máx 50 p/ schedules, 100 demais
await umov.schedules.upsertBatch(schedules)          // lança RangeError acima do limite
await umov.items.upsertBatch(items, { chunked: true }) // divide em lotes (cada um atômico à parte)

// Mensageria
await umov.messages.send({ recipients: ['TEC-042'], description: 'Nova OS', sendNotification: true })

// Custom entities / Mix
const entries = umov.customEntities.entries({ altId: 'CADASTRO-X' })
await entries.create({ description: 'Reg 1', customFields: { campo: 'valor' } })

// Webhook (route handler Next/Express)
import { parseCallbackXml } from '@laivon/umov-sdk/webhook'
const { activityHistoryIds } = parseCallbackXml(body)
const laudo = await umov.activityHistories.hierarchical(activityHistoryIds[0])
```

## API 2.0 (JSON)

A uMov.me tem uma segunda API, JSON, autenticada por headers `AppId`/`AppKey` (pedidas ao suporte). Ela é **só escrita** — não existe GET — então o uso natural é **ler pela v1 e escrever pela v2**. O SDK expõe as 302 operações em `umov.v2.*`; quem usa só a v1 não precisa mudar nada.

```ts
new UmovClient({ apiKey })                               // só v1 (como sempre)
new UmovClient({ v2: { appId: 2, appKey: '…' } })        // só v2
new UmovClient({ apiKey, v2: { appId: 2, appKey: '…' } }) // as duas no mesmo cliente
const v2 = new UmovV2Client({ appId: 2, appKey: '…' })   // cliente v2 avulso

// Escrita: create → POST, put → PUT (total), patch → PATCH (parcial), remove → DELETE
const { id } = await umov.v2.agents.create({ name: 'Ana', login: 'ana', agentType: { alternativeIdentifier: 'TEC' } })
await umov.v2.tasks.patch({ altId: 'OS-123' }, { priority: 0 })
await umov.v2.tasks.activities.add({ altId: 'OS-123' }, { altId: 'VISTORIA' }) // refs do mesmo tipo nos dois lados
await umov.v2.tasks.transfer({ taskAlternativeIdentifiers: ['OS-123'], destinationAgentAlternativeIdentifier: 'TEC-042' })

// Custom fields na v2 são um array; converta o estilo v1 com o helper
await umov.v2.locals.patch('LOJA-9', { customFields: customFieldsFromMap({ regiao: 'sul', tags: ['a', 'b'] }) })

// Erros trazem as chaves estáveis da v2
try { await umov.v2.agents.create({ name: 'x', webUser: true }) }
catch (e) { if (e instanceof UmovValidationError && e.hasKey('field_required')) console.log(e.keys) }
```

- Mesmas classes de erro da v1 (`UmovValidationError` 400, `UmovAuthError` 401, …); `e.messages` / `e.keys` / `e.hasKey('prefixo')` só vêm preenchidos na v2.
- Rate limit, retry em 429 (e em 504/rede só para PUT/PATCH/DELETE — POST nunca é retentado) e redação da `AppKey` em logs, como na v1.
- Campos `yyyy-MM-dd` aceitam `Date`; os demais formatos (`HH:mm`, `HHmmss`, ISO) são `string`.
- `umov.v2.transport.post/put/patch/delete(path, body)` para qualquer rota que ainda não tenha wrapper.
- Referência completa: [docs/api-v2.md](docs/api-v2.md) (conhecimento consolidado da API) e [docs/entities.md](docs/entities.md#api-20-json) (mapa dos recursos).

## Testes de integração

Bateria real contra o ambiente configurado em `.env` (`UMOV_API_KEY`), validada contra um ambiente real:

```bash
npm run test:integration
```

A bateria da v2 (`tests/integration/api-v2.itest.ts`) roda só se `UMOV_APP_ID` e `UMOV_APP_KEY` estiverem no env/`.env`.

## Comportamentos embutidos

- **Rate limit**: 4 req/s (limite da uMov.me) com retry/backoff automático em 429 (respeita `Retry-After`); GETs também em 504.
- **Paginação**: o tamanho de página é **configuração do seu ambiente** (25, 50 ou 100) e `<size>` na resposta é o tamanho da página, não o total. `iterate` detecta o fim automaticamente (no máximo uma requisição extra); informe `pageSize: 25 | 50 | 100` em `UmovClient` para eliminar essa requisição.
- **Token seguro**: a apiKey vai na URL (exigência da API), mas é redigida (`***`) em toda mensagem de erro e log.
- **Erros tipados**: `UmovAuthError` (401), `UmovNotFoundError` (404), `UmovValidationError` (400), `UmovRateLimitError` (429), `UmovApiNotEnabledError` (501), `UmovTimeoutError` (504).
- **Escaping**: CDATA + `%25`/`%26`, nomes de custom fields com `__`, multi-valores com pipe — tudo automático.
- **Endereçamento duplo**: todo método aceita `id` numérico ou `{ altId: '...' }` (alternativeIdentifier).

## Desenvolvimento

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # tsup → dist/
```

Spec e plano: `docs/superpowers/`. Referência da API extraída da doc oficial: `docs/api-map.json`.
