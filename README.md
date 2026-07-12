# @laivon/umov-sdk

SDK TypeScript para a API CenterWeb da [uMov.me](https://www.umov.me). Node ≥ 18. XML 100% interno — você fala objetos tipados.

## Instalação

```bash
npm install git+ssh://git@<host-privado>/laivon/umov-sdk.git
```

## Uso

```ts
import { UmovClient } from '@laivon/umov-sdk'

const umov = new UmovClient({ apiKey: process.env.UMOV_API_KEY! })

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

## Testes de integração

Bateria real contra o ambiente configurado em `.env` (`UMOV_API_KEY`), validada contra o ambiente laivon:

```bash
npm run test:integration
```

## Comportamentos embutidos

- **Rate limit**: 4 req/s (limite da uMov.me) com retry/backoff automático em 429 (respeita `Retry-After`); GETs também em 504.
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
