# @laivon/umov-sdk — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Núcleo completo do SDK (transporte, XML, erros, rate limit, paginação, factory de recursos) + entidades de leitura para laudos: agents, schedules (+cancel), serviceLocals, activities/sections/sectionFields, activityHistories (+hierarchical), geoCoordinates, customFields.

**Architecture:** Core genérico + recursos tipados declarativos. `Transport` fala HTTP/XML com a API CenterWeb (`https://api.umov.me/CenterWeb/api/{apiKey}/{recurso}.xml`, POST `data=` form-encoded); `defineResource()` gera list/iterate/get/create/update tipados por entidade; recursos com endpoints irregulares (activityHistories, customFields) têm módulos próprios. Consumidor nunca vê XML.

**Tech Stack:** TypeScript 5 (strict), Node ≥ 18 (fetch nativo), fast-xml-parser (única dep de runtime), tsup (ESM+CJS+d.ts), vitest, eslint.

**Spec:** `docs/superpowers/specs/2026-07-12-umov-sdk-design.md` (seções §4 core, §5 recursos, §7 riscos). Referência da API: `docs/api-map.json`.

**Regras do projeto:** TDD estrito (teste falhando → implementação mínima → verde → commit). Working dir: `c:\Projetos\Laivon\umov-sdk`. Todos os commits terminam com `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `.gitignore`, `src/index.ts`

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "@laivon/umov-sdk",
  "version": "0.1.0",
  "description": "SDK TypeScript para a API CenterWeb da uMov.me",
  "license": "UNLICENSED",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "declaration": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist"
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Criar `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
})
```

- [ ] **Step 4: Criar `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 5: Criar `.gitignore`**

```
node_modules/
dist/
coverage/
*.tsbuildinfo
.env
```

- [ ] **Step 6: Criar `src/index.ts` provisório**

```ts
export const SDK_NAME = '@laivon/umov-sdk'
```

- [ ] **Step 7: Instalar dependências**

Run: `npm install fast-xml-parser && npm install -D typescript tsup vitest @types/node`
Expected: `node_modules/` criado sem erros.

- [ ] **Step 8: Verificar toolchain**

Run: `npx tsc --noEmit && npx tsup && npx vitest run`
Expected: typecheck OK; build gera `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`; vitest reporta "no test files found" (exit 0 — se exit 1 por falta de testes, adicionar `passWithNoTests: true` no vitest.config.ts).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold do projeto (tsup, vitest, tsconfig strict)"
```

---

### Task 2: `core/errors.ts` — hierarquia de erros tipados

**Files:**
- Create: `src/core/errors.ts`
- Test: `tests/core/errors.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it } from 'vitest'
import {
  UmovApiError,
  UmovAuthError,
  UmovValidationError,
  UmovNotFoundError,
  UmovRateLimitError,
  UmovApiNotEnabledError,
  UmovTimeoutError,
  errorFromStatus,
} from '../../src/core/errors'

const ctx = { method: 'GET', url: 'https://api.umov.me/CenterWeb/api/***/agent.xml', responseBody: '<error/>' }

describe('errorFromStatus', () => {
  it.each([
    [400, UmovValidationError],
    [401, UmovAuthError],
    [404, UmovNotFoundError],
    [429, UmovRateLimitError],
    [501, UmovApiNotEnabledError],
    [504, UmovTimeoutError],
    [500, UmovApiError],
  ])('mapeia %i para a subclasse correta', (status, cls) => {
    const err = errorFromStatus(status, ctx)
    expect(err).toBeInstanceOf(cls)
    expect(err).toBeInstanceOf(UmovApiError)
    expect(err.status).toBe(status)
    expect(err.method).toBe('GET')
    expect(err.responseBody).toBe('<error/>')
    expect(err.message).toContain(String(status))
  })

  it('preserva a URL (já redigida pelo transport) na mensagem', () => {
    const err = errorFromStatus(404, ctx)
    expect(err.url).toContain('***')
    expect(err.url).not.toMatch(/[0-9a-f]{16,}/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/errors.test.ts`
Expected: FAIL — módulo `src/core/errors` não existe.

- [ ] **Step 3: Implementar**

```ts
export interface UmovErrorContext {
  method: string
  /** URL com o apiKey já substituído por *** (redigida pelo Transport). */
  url: string
  responseBody: string
}

export class UmovApiError extends Error {
  readonly status: number
  readonly method: string
  readonly url: string
  readonly responseBody: string

  constructor(status: number, ctx: UmovErrorContext, detail?: string) {
    super(`uMov.me API ${status}${detail ? ` (${detail})` : ''}: ${ctx.method} ${ctx.url}`)
    this.name = new.target.name
    this.status = status
    this.method = ctx.method
    this.url = ctx.url
    this.responseBody = ctx.responseBody
  }
}

export class UmovValidationError extends UmovApiError {}
export class UmovAuthError extends UmovApiError {}
export class UmovNotFoundError extends UmovApiError {}
export class UmovRateLimitError extends UmovApiError {}
export class UmovApiNotEnabledError extends UmovApiError {}
export class UmovTimeoutError extends UmovApiError {}

export function errorFromStatus(status: number, ctx: UmovErrorContext): UmovApiError {
  switch (status) {
    case 400: return new UmovValidationError(status, ctx, 'requisição malformada')
    case 401: return new UmovAuthError(status, ctx, 'apiKey inválida')
    case 404: return new UmovNotFoundError(status, ctx, 'não encontrado')
    case 429: return new UmovRateLimitError(status, ctx, 'rate limit excedido')
    case 501: return new UmovApiNotEnabledError(status, ctx, 'entidade não habilitada para API neste ambiente')
    case 504: return new UmovTimeoutError(status, ctx, 'timeout no servidor')
    default: return new UmovApiError(status, ctx)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/errors.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/errors.ts tests/core/errors.test.ts
git commit -m "feat(core): hierarquia de erros tipados por status HTTP"
```

---

### Task 3: `core/types.ts` — EntityRef e resolução de path

**Files:**
- Create: `src/core/types.ts`
- Test: `tests/core/types.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it } from 'vitest'
import { refToPath } from '../../src/core/types'

describe('refToPath', () => {
  it('number vira path por id', () => {
    expect(refToPath(123)).toBe('123')
  })
  it('{id} vira path por id', () => {
    expect(refToPath({ id: 123 })).toBe('123')
  })
  it('string vira path por alternativeIdentifier', () => {
    expect(refToPath('OS-123')).toBe('alternativeIdentifier/OS-123')
  })
  it('{altId} vira path por alternativeIdentifier', () => {
    expect(refToPath({ altId: 'OS-123' })).toBe('alternativeIdentifier/OS-123')
  })
  it('encoda caracteres especiais no altId', () => {
    expect(refToPath({ altId: 'OS 12/3' })).toBe('alternativeIdentifier/OS%2012%2F3')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/types.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
/**
 * Referência a um registro da uMov.me.
 * - `number` ou `{ id }` → id interno → `/recurso/{id}.xml`
 * - `string` ou `{ altId }` → alternativeIdentifier → `/recurso/alternativeIdentifier/{altId}.xml`
 */
export type EntityRef = number | string | { id: number } | { altId: string }

export function refToPath(ref: EntityRef): string {
  if (typeof ref === 'number') return String(ref)
  if (typeof ref === 'string') return `alternativeIdentifier/${encodeURIComponent(ref)}`
  if ('id' in ref) return String(ref.id)
  return `alternativeIdentifier/${encodeURIComponent(ref.altId)}`
}

/** Referência a entidade relacionada dentro de um payload (ex.: agent de um schedule). */
export type RelationRef = { id: number } | { alternativeIdentifier: string }

export interface ListStub {
  id: number
  link: string
}

export interface ListPage {
  size: number
  entries: ListStub[]
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/types.test.ts`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts tests/core/types.test.ts
git commit -m "feat(core): EntityRef com endereçamento duplo id/alternativeIdentifier"
```

---

### Task 4: `util/datetime.ts` — datas no formato da API

**Files:**
- Create: `src/util/datetime.ts`
- Test: `tests/util/datetime.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it } from 'vitest'
import { formatDateTime, formatDate } from '../../src/util/datetime'

describe('formatDateTime', () => {
  it('formata Date como YYYY-MM-DD HH:MM:SS (hora local)', () => {
    expect(formatDateTime(new Date(2026, 6, 12, 9, 5, 3))).toBe('2026-07-12 09:05:03')
  })
  it('deixa string passar intacta', () => {
    expect(formatDateTime('2026-07-12 09:05:03')).toBe('2026-07-12 09:05:03')
  })
})

describe('formatDate', () => {
  it('formata Date como YYYY-MM-DD', () => {
    expect(formatDate(new Date(2026, 6, 2))).toBe('2026-07-02')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/util/datetime.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
const pad = (n: number) => String(n).padStart(2, '0')

/** Formato da API: YYYY-MM-DD HH:MM:SS (doc uMov.me). Strings passam intactas. */
export function formatDateTime(value: Date | string): string {
  if (typeof value === 'string') return value
  return `${formatDate(value)} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
}

export function formatDate(value: Date | string): string {
  if (typeof value === 'string') return value
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/util/datetime.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/util/datetime.ts tests/util/datetime.test.ts
git commit -m "feat(util): formatação de datas no padrão da API"
```

---

### Task 5: `core/xml.ts` — serialização e parse com as regras da uMov.me

Regras (spec §2): valores string com caracteres especiais em CDATA; dentro de CDATA `%`→`%25` e `&`→`%26`; nomes de custom fields com espaço→`__`; arrays de valores de custom field → pipe (`a|b`); parse mantém strings (sem coerção automática do parser) e decodifica `%25`/`%26` simetricamente.

**Files:**
- Create: `src/core/xml.ts`
- Test: `tests/core/xml.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it } from 'vitest'
import { serializeEntity, parseXml, encodeCustomFieldName, decodeText } from '../../src/core/xml'

describe('serializeEntity', () => {
  it('serializa objeto plano', () => {
    expect(serializeEntity('agentType', { description: 'Tecnico', active: true })).toBe(
      '<agentType><description>Tecnico</description><active>true</active></agentType>',
    )
  })

  it('serializa objetos aninhados e números', () => {
    expect(serializeEntity('schedule', { agent: { id: 7 }, situation: { id: 70 } })).toBe(
      '<schedule><agent><id>7</id></agent><situation><id>70</id></situation></schedule>',
    )
  })

  it('envolve valores com caracteres especiais em CDATA com %25/%26', () => {
    expect(serializeEntity('item', { description: 'Café 100% & extra <forte>' })).toBe(
      '<item><description><![CDATA[Café 100%25 %26 extra <forte>]]></description></item>',
    )
  })

  it('serializa customFields com nomes encodados e multi-valor pipe', () => {
    const xml = serializeEntity('agent', {
      customFields: { 'numero da nota': '42', regioes: ['0', '1'] },
    })
    expect(xml).toBe(
      '<agent><customFields><numero__da__nota>42</numero__da__nota><regioes>0|1</regioes></customFields></agent>',
    )
  })

  it('omite undefined e null', () => {
    expect(serializeEntity('agent', { name: 'Ana', email: undefined, phone: null })).toBe(
      '<agent><name>Ana</name></agent>',
    )
  })

  it('serializa arrays de objetos como elementos repetidos', () => {
    expect(
      serializeEntity('schedules', { schedule: [{ id: 1 }, { id: 2 }] }),
    ).toBe('<schedules><schedule><id>1</id></schedule><schedule><id>2</id></schedule></schedules>')
  })
})

describe('parseXml', () => {
  it('parseia detalhe preservando strings e atributos com prefixo $', () => {
    const obj = parseXml('<agent><id>12</id><name>Ana</name><active>true</active></agent>')
    expect(obj).toEqual({ agent: { id: '12', name: 'Ana', active: 'true' } })
  })

  it('decodifica %25 e %26 em valores de texto', () => {
    const obj = parseXml('<item><description>Café 100%25 %26 extra</description></item>')
    expect(obj).toEqual({ item: { description: 'Café 100% & extra' } })
  })

  it('expõe atributos de entry', () => {
    const obj = parseXml('<entries><entry id="5" link="/agent/5.xml"/></entries>') as {
      entries: { entry: { $id: string; $link: string } }
    }
    expect(obj.entries.entry.$id).toBe('5')
    expect(obj.entries.entry.$link).toBe('/agent/5.xml')
  })
})

describe('encodeCustomFieldName', () => {
  it('troca espaços por __ duplo', () => {
    expect(encodeCustomFieldName('numero da nota fiscal')).toBe('numero__da__nota__fiscal')
  })
})

describe('decodeText', () => {
  it('reverte a codificação de request', () => {
    expect(decodeText('100%25 %26 fim')).toBe('100% & fim')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/xml.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { XMLParser } from 'fast-xml-parser'

/** Espaços em nomes de custom fields viram __ (doc uMov.me). */
export function encodeCustomFieldName(name: string): string {
  return name.replace(/ /g, '__')
}

/** Codificação exigida dentro de CDATA: % → %25, & → %26. Ordem importa (% primeiro). */
export function encodeText(value: string): string {
  return value.replace(/%/g, '%25').replace(/&/g, '%26')
}

/** Decodificação simétrica das respostas (spec §7 R15). Ordem inversa. */
export function decodeText(value: string): string {
  return value.replace(/%26/g, '&').replace(/%25/g, '%')
}

const NEEDS_CDATA = /[<>&%\n\r]/

function serializeValue(value: string | number | boolean): string {
  if (typeof value !== 'string') return String(value)
  if (!NEEDS_CDATA.test(value)) return value
  return `<![CDATA[${encodeText(value)}]]>`
}

type Scalar = string | number | boolean
type Serializable = Scalar | null | undefined | Serializable[] | { [key: string]: Serializable }

function serializeNode(name: string, value: Serializable): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => serializeNode(name, v)).join('')
  if (typeof value === 'object') {
    if (name === 'customFields') {
      const inner = Object.entries(value)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => {
          const joined = Array.isArray(v) ? (v as Scalar[]).map(String).join('|') : (v as Scalar)
          return serializeNode(encodeCustomFieldName(k), joined)
        })
        .join('')
      return `<customFields>${inner}</customFields>`
    }
    const inner = Object.entries(value)
      .map(([k, v]) => serializeNode(k, v))
      .join('')
    return `<${name}>${inner}</${name}>`
  }
  return `<${name}>${serializeValue(value)}</${name}>`
}

/** Serializa um payload de entidade para o XML aceito pela API. */
export function serializeEntity(rootName: string, payload: Record<string, Serializable>): string {
  return serializeNode(rootName, payload)
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '$',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
})

function decodeDeep(node: unknown): unknown {
  if (typeof node === 'string') return decodeText(node)
  if (Array.isArray(node)) return node.map(decodeDeep)
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, decodeDeep(v)]))
  }
  return node
}

/** Parseia XML da API em objeto JS. Valores permanecem strings; atributos ganham prefixo $. */
export function parseXml(xml: string): Record<string, unknown> {
  return decodeDeep(parser.parse(xml)) as Record<string, unknown>
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/xml.test.ts`
Expected: PASS (12 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/xml.ts tests/core/xml.test.ts
git commit -m "feat(core): camada XML com CDATA, escaping %25/%26 e custom fields"
```

---

### Task 6: `core/envelope.ts` — parse do envelope `<result>`

Formato real (validado no crawler-umov): listas retornam `<result><resourceName>x</resourceName><size>N</size><entries><entry id=".." link=".."/></entries></result>`; escritas retornam `<result><resourceName>x</resourceName><resourceId>N</resourceId><link>..</link></result>`; detalhes retornam a entidade como raiz (`<agent>...</agent>`).

**Files:**
- Create: `src/core/envelope.ts`
- Test: `tests/core/envelope.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it } from 'vitest'
import { parseListResponse, parseWriteResponse, parseDetailResponse } from '../../src/core/envelope'

describe('parseListResponse', () => {
  it('extrai size e stubs', () => {
    const xml = `<result><resourceName>agent</resourceName><size>2</size><entries>
      <entry id="10" link="/agent/10.xml"/><entry id="11" link="/agent/11.xml"/>
    </entries></result>`
    expect(parseListResponse(xml)).toEqual({
      size: 2,
      entries: [
        { id: 10, link: '/agent/10.xml' },
        { id: 11, link: '/agent/11.xml' },
      ],
    })
  })

  it('lida com entry único (não-array)', () => {
    const xml = `<result><size>1</size><entries><entry id="7" link="/agent/7.xml"/></entries></result>`
    expect(parseListResponse(xml).entries).toEqual([{ id: 7, link: '/agent/7.xml' }])
  })

  it('lida com lista vazia sem <entries>', () => {
    const xml = `<result><resourceName>agent</resourceName><size>0</size></result>`
    expect(parseListResponse(xml)).toEqual({ size: 0, entries: [] })
  })
})

describe('parseWriteResponse', () => {
  it('extrai resourceId', () => {
    const xml = `<result><resourceName>schedule</resourceName><resourceId>555</resourceId><link>/schedule/555.xml</link></result>`
    expect(parseWriteResponse(xml)).toEqual({ resourceName: 'schedule', id: 555, link: '/schedule/555.xml' })
  })
})

describe('parseDetailResponse', () => {
  it('desembrulha a raiz e coerce id/active', () => {
    const xml = `<agent><id>12</id><name>Ana</name><active>true</active><agentType><id>3</id><description>Tec</description></agentType></agent>`
    expect(parseDetailResponse(xml, 'agent')).toEqual({
      id: 12,
      name: 'Ana',
      active: true,
      agentType: { id: 3, description: 'Tec' },
    })
  })

  it('lança se a raiz esperada não existe', () => {
    expect(() => parseDetailResponse('<other/>', 'agent')).toThrow(/agent/)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/envelope.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { parseXml } from './xml'
import type { ListPage, ListStub } from './types'

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

export function parseListResponse(xml: string): ListPage {
  const doc = parseXml(xml) as {
    result?: { size?: string; entries?: { entry?: unknown } }
  }
  if (!doc.result) throw new Error('Resposta de lista sem <result>')
  const entries: ListStub[] = asArray(doc.result.entries?.entry as { $id: string; $link?: string } | Array<{ $id: string; $link?: string }>).map(
    (e) => ({ id: Number(e.$id), link: e.$link ?? '' }),
  )
  return { size: Number(doc.result.size ?? entries.length), entries }
}

export function parseWriteResponse(xml: string): { resourceName: string; id: number; link?: string } {
  const doc = parseXml(xml) as {
    result?: { resourceName?: string; resourceId?: string; link?: string }
  }
  if (!doc.result?.resourceId) throw new Error('Resposta de escrita sem <resourceId>')
  return {
    resourceName: doc.result.resourceName ?? '',
    id: Number(doc.result.resourceId),
    link: doc.result.link,
  }
}

/** Coerção conservadora: chaves `id` numéricas → number; 'true'/'false' → boolean. */
function coerceDeep(node: unknown, key?: string): unknown {
  if (typeof node === 'string') {
    if (key === 'id' && /^\d+$/.test(node)) return Number(node)
    if (node === 'true') return true
    if (node === 'false') return false
    return node
  }
  if (Array.isArray(node)) return node.map((n) => coerceDeep(n, key))
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, coerceDeep(v, k)]))
  }
  return node
}

export function parseDetailResponse<T>(xml: string, rootName: string): T {
  const doc = parseXml(xml)
  const root = doc[rootName]
  if (root === undefined) throw new Error(`Resposta sem raiz <${rootName}>`)
  return coerceDeep(root) as T
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/envelope.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/envelope.ts tests/core/envelope.test.ts
git commit -m "feat(core): parse do envelope result (listas, escritas, detalhe)"
```

---

### Task 7: `core/rate-limit.ts` — token bucket

**Files:**
- Create: `src/core/rate-limit.ts`
- Test: `tests/core/rate-limit.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RateLimiter } from '../../src/core/rate-limit'

describe('RateLimiter', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('espaça aquisições em 1/rps segundos', async () => {
    const limiter = new RateLimiter(4) // 250ms entre requests
    const timestamps: number[] = []
    const run = (async () => {
      for (let i = 0; i < 3; i++) {
        await limiter.acquire()
        timestamps.push(Date.now())
      }
    })()
    await vi.advanceTimersByTimeAsync(1000)
    await run
    expect(timestamps[1]! - timestamps[0]!).toBeGreaterThanOrEqual(250)
    expect(timestamps[2]! - timestamps[1]!).toBeGreaterThanOrEqual(250)
  })

  it('primeira aquisição é imediata', async () => {
    const limiter = new RateLimiter(4)
    const p = limiter.acquire()
    await vi.advanceTimersByTimeAsync(0)
    await expect(p).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/rate-limit.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

/** Espaça chamadas em 1000/rps ms — a uMov.me limita em 4 req/s por token. */
export class RateLimiter {
  private nextSlot = 0

  constructor(private readonly rps: number) {}

  async acquire(): Promise<void> {
    const now = Date.now()
    const wait = Math.max(0, this.nextSlot - now)
    this.nextSlot = Math.max(now, this.nextSlot) + 1000 / this.rps
    if (wait > 0) await sleep(wait)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/rate-limit.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/rate-limit.ts tests/core/rate-limit.test.ts
git commit -m "feat(core): rate limiter 4 req/s"
```

---

### Task 8: `core/transport.ts` — HTTP com retry, redação de token e `data=`

**Files:**
- Create: `src/core/transport.ts`
- Test: `tests/core/transport.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { Transport } from '../../src/core/transport'
import { UmovAuthError, UmovRateLimitError } from '../../src/core/errors'

const API_KEY = 'a1b2c3d4e5f6a1b2c3d4'

function makeTransport(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return new Transport({
    apiKey: API_KEY,
    baseUrl: 'https://api.umov.me/CenterWeb/api',
    requestsPerSecond: 1000, // sem espera nos testes
    maxRetries: 2,
    timeoutMs: 5000,
    fetch: fetchImpl,
    ...extra,
  })
}

const ok = (body: string) => new Response(body, { status: 200 })

describe('Transport.get', () => {
  it('monta URL com apiKey no path e query encodada', async () => {
    const fetchMock = vi.fn(async () => ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await t.get('agent.xml', { name: 'Ana Souza', 'paging.page': '2', dateTime: '2026-07-12 09:00:00' })
    const url = fetchMock.mock.calls[0]![0] as string
    expect(url).toBe(
      `https://api.umov.me/CenterWeb/api/${API_KEY}/agent.xml?name=Ana%20Souza&paging.page=2&dateTime=2026-07-12%2009%3A00%3A00`,
    )
  })

  it('lança UmovAuthError em 401 com URL redigida', async () => {
    const fetchMock = vi.fn(async () => new Response('<error/>', { status: 401 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    const err = await t.get('agent.xml').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(UmovAuthError)
    expect((err as UmovAuthError).url).not.toContain(API_KEY)
    expect((err as UmovAuthError).url).toContain('***')
    expect((err as UmovAuthError).message).not.toContain(API_KEY)
  })

  it('faz retry em 429 e sucede', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('rate', { status: 429 }))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('esgota retries em 429 e lança UmovRateLimitError', async () => {
    const fetchMock = vi.fn(async () => new Response('rate', { status: 429 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).rejects.toBeInstanceOf(UmovRateLimitError)
    expect(fetchMock).toHaveBeenCalledTimes(3) // 1 + 2 retries
  })
})

describe('Transport.post', () => {
  it('envia XML como data= form-encoded', async () => {
    const fetchMock = vi.fn(async () => ok('<result><resourceId>1</resourceId></result>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch)
    await t.post('agent.xml', '<agent><name>Ana & Cia</name></agent>')
    const [, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe(
      'application/x-www-form-urlencoded',
    )
    expect(init.body).toBe(`data=${encodeURIComponent('<agent><name>Ana & Cia</name></agent>')}`)
  })

  it('não faz retry de POST em 504 (não idempotente)', async () => {
    const fetchMock = vi.fn(async () => new Response('to', { status: 504 }))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.post('agent.xml', '<agent/>')).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('faz retry de GET em 504', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('to', { status: 504 }))
      .mockResolvedValueOnce(ok('<result/>'))
    const t = makeTransport(fetchMock as unknown as typeof fetch, { retryBaseMs: 1 })
    await expect(t.get('agent.xml')).resolves.toBe('<result/>')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/transport.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { errorFromStatus, UmovApiError } from './errors'
import { RateLimiter } from './rate-limit'

export interface UmovLogEvent {
  type: 'request' | 'retry' | 'error'
  method: string
  url: string // sempre redigida
  status?: number
  attempt?: number
}

export interface TransportOptions {
  apiKey: string
  baseUrl?: string
  requestsPerSecond?: number
  maxRetries?: number
  timeoutMs?: number
  retryBaseMs?: number
  fetch?: typeof fetch
  logger?: (event: UmovLogEvent) => void
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms))

export class Transport {
  private readonly apiKey: string
  private readonly baseUrl: string
  private readonly maxRetries: number
  private readonly timeoutMs: number
  private readonly retryBaseMs: number
  private readonly fetchImpl: typeof fetch
  private readonly logger?: (event: UmovLogEvent) => void
  private readonly limiter: RateLimiter

  constructor(opts: TransportOptions) {
    this.apiKey = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? 'https://api.umov.me/CenterWeb/api').replace(/\/$/, '')
    this.maxRetries = opts.maxRetries ?? 3
    this.timeoutMs = opts.timeoutMs ?? 30_000
    this.retryBaseMs = opts.retryBaseMs ?? 500
    this.fetchImpl = opts.fetch ?? globalThis.fetch
    this.logger = opts.logger
    this.limiter = new RateLimiter(opts.requestsPerSecond ?? 4)
  }

  /** Query encodada manualmente: espaço→%20 e ':'→%3A (exigência da doc; URLSearchParams usaria '+'). */
  private buildUrl(path: string, query?: Record<string, string>): string {
    let url = `${this.baseUrl}/${this.apiKey}/${path}`
    if (query && Object.keys(query).length > 0) {
      const qs = Object.entries(query)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&')
      url += `?${qs}`
    }
    return url
  }

  /** Token nunca aparece em logs/erros. */
  redact(url: string): string {
    return url.split(this.apiKey).join('***')
  }

  private async request(method: 'GET' | 'POST' | 'DELETE', path: string, query?: Record<string, string>, body?: string): Promise<string> {
    const url = this.buildUrl(path, query)
    const redacted = this.redact(url)
    const init: RequestInit = { method }
    if (body !== undefined) {
      init.headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
      init.body = `data=${encodeURIComponent(body)}`
    }

    for (let attempt = 0; ; attempt++) {
      await this.limiter.acquire()
      this.logger?.({ type: 'request', method, url: redacted, attempt })

      let res: Response
      try {
        res = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) })
      } catch (cause) {
        if (attempt < this.maxRetries) {
          await sleep(this.retryBaseMs * 2 ** attempt)
          this.logger?.({ type: 'retry', method, url: redacted, attempt })
          continue
        }
        throw new UmovApiError(0, { method, url: redacted, responseBody: String(cause) }, 'falha de rede/timeout')
      }

      const text = await res.text()
      if (res.ok) return text

      const retryable = res.status === 429 || (res.status === 504 && method === 'GET')
      if (retryable && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get('Retry-After'))
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : this.retryBaseMs * 2 ** attempt
        this.logger?.({ type: 'retry', method, url: redacted, status: res.status, attempt })
        await sleep(wait)
        continue
      }

      this.logger?.({ type: 'error', method, url: redacted, status: res.status, attempt })
      throw errorFromStatus(res.status, { method, url: redacted, responseBody: text })
    }
  }

  get(path: string, query?: Record<string, string>): Promise<string> {
    return this.request('GET', path, query)
  }

  post(path: string, xmlBody: string): Promise<string> {
    return this.request('POST', path, undefined, xmlBody)
  }

  delete(path: string): Promise<string> {
    return this.request('DELETE', path)
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/transport.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/transport.ts tests/core/transport.test.ts
git commit -m "feat(core): transporte HTTP com data= form-encoding, retry e redação de token"
```

---

### Task 9: `core/pagination.ts` — iteração auto-paginada e hydrate

**Files:**
- Create: `src/core/pagination.ts`
- Test: `tests/core/pagination.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { iterateStubs, hydrateStubs } from '../../src/core/pagination'
import type { ListPage, ListStub } from '../../src/core/types'

const stub = (id: number): ListStub => ({ id, link: `/x/${id}.xml` })
const page = (ids: number[]): ListPage => ({ size: ids.length, entries: ids.map(stub) })

describe('iterateStubs', () => {
  it('para quando a página vem com menos de 100 entradas', async () => {
    const fetchPage = vi
      .fn<(p: number) => Promise<ListPage>>()
      .mockResolvedValueOnce(page(Array.from({ length: 100 }, (_, i) => i + 1)))
      .mockResolvedValueOnce(page([101, 102]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toHaveLength(102)
    expect(fetchPage).toHaveBeenCalledTimes(2)
    expect(fetchPage).toHaveBeenNthCalledWith(1, 1)
    expect(fetchPage).toHaveBeenNthCalledWith(2, 2)
  })

  it('para imediatamente em página vazia', async () => {
    const fetchPage = vi.fn(async () => page([]))
    const ids: number[] = []
    for await (const s of iterateStubs(fetchPage)) ids.push(s.id)
    expect(ids).toEqual([])
    expect(fetchPage).toHaveBeenCalledTimes(1)
  })
})

describe('hydrateStubs', () => {
  it('resolve detalhes preservando a ordem', async () => {
    async function* stubs() {
      yield stub(1)
      yield stub(2)
      yield stub(3)
    }
    const get = vi.fn(async (id: number) => ({ id, name: `n${id}` }))
    const out: Array<{ id: number; name: string }> = []
    for await (const d of hydrateStubs(stubs(), get, 2)) out.push(d)
    expect(out.map((d) => d.id)).toEqual([1, 2, 3])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/pagination.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import type { ListPage, ListStub } from './types'

export const PAGE_SIZE = 100

/** Auto-paginação: pede paging.page=1,2,... e para quando a página vem incompleta (spec §7 R5). */
export async function* iterateStubs(fetchPage: (page: number) => Promise<ListPage>): AsyncGenerator<ListStub> {
  for (let page = 1; ; page++) {
    const { entries } = await fetchPage(page)
    for (const entry of entries) yield entry
    if (entries.length < PAGE_SIZE) return
  }
}

/**
 * Resolve o N+1 da API (listas retornam stubs): busca o detalhe de cada stub com uma
 * janela de prefetch. A concorrência real é governada pelo RateLimiter do Transport.
 */
export async function* hydrateStubs<T>(
  stubs: AsyncGenerator<ListStub>,
  get: (id: number) => Promise<T>,
  prefetch = 4,
): AsyncGenerator<T> {
  const window: Promise<T>[] = []
  for await (const stub of stubs) {
    window.push(get(stub.id))
    if (window.length >= prefetch) yield await window.shift()!
  }
  while (window.length > 0) yield await window.shift()!
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/pagination.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/pagination.ts tests/core/pagination.test.ts
git commit -m "feat(core): auto-paginação e hydrate com janela de prefetch"
```

---

### Task 10: `core/resource.ts` — factory `defineResource`

**Files:**
- Create: `src/core/resource.ts`
- Test: `tests/core/resource.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { defineResource, filtersToQuery } from '../../src/core/resource'
import { Transport } from '../../src/core/transport'

const listXml = `<result><size>1</size><entries><entry id="9" link="/widget/9.xml"/></entries></result>`
const detailXml = `<widget><id>9</id><name>W</name><active>true</active></widget>`
const writeXml = `<result><resourceName>widget</resourceName><resourceId>77</resourceId></result>`

interface Widget { id: number; name: string; active: boolean }
interface WidgetCreate { name: string; active?: boolean }
interface WidgetFilters { name?: string; active?: boolean; initialInsertDateTime?: Date | string; raw?: Record<string, string> }

function makeResource(responses: Record<string, string>) {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = String(url)
    const key = Object.keys(responses).find((k) => u.includes(k))
    if (!key) throw new Error(`sem mock para ${u}`)
    return new Response(responses[key]!, { status: 200 })
  })
  const transport = new Transport({
    apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch,
  })
  const resource = defineResource<Widget, WidgetCreate, Partial<WidgetCreate>, WidgetFilters>(transport, { path: 'widget' })
  return { resource, fetchMock }
}

describe('filtersToQuery', () => {
  it('serializa booleanos, datas e raw', () => {
    expect(
      filtersToQuery({
        active: true,
        initialInsertDateTime: new Date(2026, 6, 1, 8, 0, 0),
        raw: { 'agentType.description': 'Tec' },
      }),
    ).toEqual({
      active: 'true',
      initialInsertDateTime: '2026-07-01 08:00:00',
      'agentType.description': 'Tec',
    })
  })
})

describe('defineResource', () => {
  it('list retorna página de stubs', async () => {
    const { resource } = makeResource({ 'widget.xml': listXml })
    const page = await resource.list()
    expect(page).toEqual({ size: 1, entries: [{ id: 9, link: '/widget/9.xml' }] })
  })

  it('list com page injeta paging.page', async () => {
    const { resource, fetchMock } = makeResource({ 'widget.xml': listXml })
    await resource.list({}, { page: 3 })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('paging.page=3')
  })

  it('get por id e por altId', async () => {
    const { resource, fetchMock } = makeResource({ '/widget/9.xml': detailXml, 'alternativeIdentifier/W-9.xml': detailXml })
    await expect(resource.get(9)).resolves.toEqual({ id: 9, name: 'W', active: true })
    await expect(resource.get({ altId: 'W-9' })).resolves.toEqual({ id: 9, name: 'W', active: true })
    expect(String(fetchMock.mock.calls[1]![0])).toContain('/widget/alternativeIdentifier/W-9.xml')
  })

  it('create POSTa na coleção e retorna id', async () => {
    const { resource, fetchMock } = makeResource({ 'widget.xml': writeXml })
    await expect(resource.create({ name: 'Novo' })).resolves.toEqual({ id: 77 })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toContain('/widget.xml')
    expect(init.body).toBe(`data=${encodeURIComponent('<widget><name>Novo</name></widget>')}`)
  })

  it('update POSTa no path do ref', async () => {
    const { resource, fetchMock } = makeResource({ '/widget/9.xml': writeXml })
    await resource.update(9, { active: false })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toContain('/widget/9.xml')
    expect(init.method).toBe('POST')
  })

  it('iterate hydrate=true resolve detalhes', async () => {
    const { resource } = makeResource({ '/widget/9.xml': detailXml, 'widget.xml': listXml })
    const out: Widget[] = []
    for await (const w of resource.iterate({}, { hydrate: true })) out.push(w)
    expect(out).toEqual([{ id: 9, name: 'W', active: true }])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/core/resource.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { parseDetailResponse, parseListResponse, parseWriteResponse } from './envelope'
import { serializeEntity } from './xml'
import { hydrateStubs, iterateStubs } from './pagination'
import { refToPath, type EntityRef, type ListPage, type ListStub } from './types'
import type { Transport } from './transport'
import { formatDateTime } from '../util/datetime'

export interface ResourceConfig {
  /** Segmento do path e nome do elemento raiz do XML (ex.: 'agent'). */
  path: string
  /** Raiz do XML quando difere do path (ex.: path 'importfiles', raiz 'import'). */
  rootName?: string
}

export interface ListOptions {
  page?: number
}

export interface IterateOptions {
  hydrate?: boolean
  prefetch?: number
}

/** Filtros tipados viram query string; `raw` passa parâmetros arbitrários (spec §7 R13). */
export function filtersToQuery(filters: Record<string, unknown>): Record<string, string> {
  const query: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null) continue
    if (key === 'raw') {
      Object.assign(query, value as Record<string, string>)
      continue
    }
    if (value instanceof Date) query[key] = formatDateTime(value)
    else query[key] = String(value)
  }
  return query
}

export interface Resource<TDetail, TCreate, TUpdate, TFilters> {
  list(filters?: TFilters, opts?: ListOptions): Promise<ListPage>
  iterate(filters?: TFilters, opts?: IterateOptions & { hydrate: true }): AsyncGenerator<TDetail>
  iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  get(ref: EntityRef): Promise<TDetail>
  create(payload: TCreate): Promise<{ id: number }>
  update(ref: EntityRef, payload: TUpdate): Promise<void>
}

export function defineResource<TDetail, TCreate, TUpdate, TFilters extends Record<string, unknown>>(
  transport: Transport,
  config: ResourceConfig,
): Resource<TDetail, TCreate, TUpdate, TFilters> {
  const { path } = config
  const rootName = config.rootName ?? path

  const list = async (filters?: TFilters, opts?: ListOptions): Promise<ListPage> => {
    const query = filtersToQuery(filters ?? {})
    if (opts?.page !== undefined) query['paging.page'] = String(opts.page)
    return parseListResponse(await transport.get(`${path}.xml`, query))
  }

  const get = async (ref: EntityRef): Promise<TDetail> =>
    parseDetailResponse<TDetail>(await transport.get(`${path}/${refToPath(ref)}.xml`), rootName)

  function iterate(filters?: TFilters, opts?: IterateOptions & { hydrate: true }): AsyncGenerator<TDetail>
  function iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  function iterate(filters?: TFilters, opts?: IterateOptions): AsyncGenerator<TDetail> | AsyncGenerator<ListStub> {
    const stubs = iterateStubs((page) => list(filters, { page }))
    if (opts?.hydrate) return hydrateStubs(stubs, (id) => get(id), opts.prefetch)
    return stubs
  }

  return {
    list,
    get,
    iterate,
    async create(payload: TCreate): Promise<{ id: number }> {
      const xml = serializeEntity(rootName, payload as Record<string, never>)
      const res = parseWriteResponse(await transport.post(`${path}.xml`, xml))
      return { id: res.id }
    },
    async update(ref: EntityRef, payload: TUpdate): Promise<void> {
      const xml = serializeEntity(rootName, payload as Record<string, never>)
      parseWriteResponse(await transport.post(`${path}/${refToPath(ref)}.xml`, xml))
    },
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/core/resource.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/resource.ts tests/core/resource.test.ts
git commit -m "feat(core): defineResource — list/iterate/get/create/update genéricos"
```

---

### Task 11: Tipos das entidades da Fase 1

Interfaces derivadas de `docs/api-map.json` (campos documentados; a API pode retornar campos extras — consumidores podem fazer cast). Sem testes próprios (só tipos); o typecheck do CI cobre.

**Files:**
- Create: `src/resources/types.ts`

- [ ] **Step 1: Criar `src/resources/types.ts`**

```ts
import type { RelationRef } from '../core/types'

/** Valores de custom fields: chave = alternativeIdentifier (ou nome) do campo. Arrays viram pipe. */
export type CustomFieldValues = Record<string, string | string[]>

// ---------- Agent ----------
export interface Agent {
  id: number
  name: string
  login?: string
  active?: boolean
  alternativeIdentifier?: string
  email?: string
  observation?: string
  agentType?: { id?: number; description?: string; alternativeIdentifier?: string }
}
export interface AgentCreate {
  name: string
  login: string
  password: string
  agentType: RelationRef
  alternativeIdentifier?: string
  active?: boolean
  email?: string
  observation?: string
  customFields?: CustomFieldValues
  image?: { imageUrlImport: string }
}
export type AgentUpdate = Partial<AgentCreate>
export interface AgentFilters {
  name?: string
  active?: boolean
  'agentType.description'?: string
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- ServiceLocal ----------
export interface ServiceLocal {
  id: number
  description?: string
  corporateName?: string
  alternativeIdentifier?: string
  active?: boolean
  country?: string
  state?: string
  city?: string
  cityNeighborhood?: string
  streetType?: string
  street?: string
  streetNumber?: string
  streetComplement?: string
  zipCode?: string
  email?: string
  observation?: string
  geoCoordinate?: string
  serviceLocalType?: { id?: number; description?: string; alternativeIdentifier?: string }
}
export interface ServiceLocalCreate {
  description: string
  corporateName?: string
  alternativeIdentifier?: string
  active?: boolean
  country?: string
  state?: string
  city?: string
  cityNeighborhood?: string
  streetType?: string
  street?: string
  streetNumber?: string
  streetComplement?: string
  zipCode?: string
  email?: string
  observation?: string
  /** Se omitida, a uMov.me deriva do endereço (fica vazia se endereço inválido). */
  geoCoordinate?: string
  serviceLocalType?: RelationRef
  customFields?: CustomFieldValues
}
export type ServiceLocalUpdate = Partial<ServiceLocalCreate>
export interface ServiceLocalFilters {
  country?: string
  active?: boolean
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- Schedule ----------
/** Situações documentadas: 30=pendente de envio, 40=em campo, 50=executada, 70=cancelada. */
export type ScheduleSituation = 30 | 40 | 50 | 70
export interface Schedule {
  id: number
  date?: string
  hour?: string
  observation?: string
  alternativeIdentifier?: string
  situation?: { id?: number; description?: string }
  agent?: { id?: number; name?: string; alternativeIdentifier?: string }
  serviceLocal?: { id?: number; description?: string; alternativeIdentifier?: string }
  activitiesOrigin?: string
}
export interface ScheduleCreate {
  agent: RelationRef
  serviceLocal: RelationRef
  date: Date | string
  hour: string
  observation?: string
  alternativeIdentifier?: string
  scheduleType?: RelationRef
  activitiesOrigin?: number
  activityRelationship?: { activity: RelationRef | RelationRef[] }
  customFields?: CustomFieldValues
}
export type ScheduleUpdate = Partial<ScheduleCreate> & { situation?: { id: ScheduleSituation } }
export interface ScheduleFilters {
  serviceLocal?: number
  'serviceLocal.alternativeIdentifier'?: string
  agent?: number
  'agent.active'?: boolean
  situation?: number
  'situation.description'?: string
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- Activity / Section / SectionField (read-only) ----------
export interface Activity {
  id: number
  description?: string
  alternativeIdentifier?: string
  active?: boolean
}
export interface ActivityFilters {
  description?: string
  initialInsertDateTime?: Date | string
  finalInsertDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}
export interface Section {
  id: number
  description?: string
  order?: string
  mandatory?: boolean
  active?: boolean
}
export interface SectionFilters {
  'activity.description'?: string
  raw?: Record<string, string>
  [key: string]: unknown
}
export interface SectionField {
  id: number
  description?: string
  /** Código de letra do tipo do campo (ex.: I, L) — mapa não documentado pela uMov.me. */
  type?: string
  active?: boolean
  alternativeIdentifier?: string
}
export interface SectionFieldFilters {
  description?: string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- ActivityHistory ----------
export interface ActivityHistory {
  id: number
  status?: string
  startTimeOnSystem?: string
  finishTimeOnSystem?: string
  endTimeSync?: string
  executionExportStatus?: string
  exportFileName?: string
  statusApproval?: string
  activity?: { id?: number; description?: string; alternativeIdentifier?: string }
  schedule?: { id?: number; alternativeIdentifier?: string }
}
export interface ActivityHistoryFilters {
  schedule?: number
  'schedule.alternativeIdentifier'?: string
  initialStartTimeOnSystem?: Date | string
  endStartTimeOnSystem?: Date | string
  initialFinishTimeOnSystem?: Date | string
  endFinishTimeOnSystem?: Date | string
  'activity.captureGPS'?: boolean
  raw?: Record<string, string>
  [key: string]: unknown
}
/** Árvore completa activity>sections>items>fields>geo — estrutura varia por atividade. */
export interface ActivityHistoryHierarchical extends ActivityHistory {
  [key: string]: unknown
}

// ---------- GeoCoordinate ----------
export interface GeoCoordinate {
  id: number
  latitude?: string
  longitude?: string
  date?: string
  type?: string
  agent?: { id?: number; name?: string }
}
export interface GeoCoordinateFilters {
  date?: Date | string
  agent?: number
  initialDate?: Date | string
  finalDate?: Date | string
  initialDateTime?: Date | string
  finalDateTime?: Date | string
  raw?: Record<string, string>
  [key: string]: unknown
}

// ---------- CustomField ----------
export interface CustomFieldEntry {
  id?: number
  alternativeIdentifier?: string
  description?: string
  active?: boolean
  value?: string
}
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/resources/types.ts
git commit -m "feat(resources): tipos das entidades da Fase 1"
```

---

### Task 12: `client.ts` — UmovClient com recursos padrão

**Files:**
- Create: `src/client.ts`
- Modify: `src/index.ts`
- Test: `tests/client.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { UmovClient } from '../src/client'

const listXml = `<result><size>0</size></result>`

function makeClient() {
  const fetchMock = vi.fn(async () => new Response(listXml, { status: 200 }))
  const client = new UmovClient({
    apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch,
  })
  return { client, fetchMock }
}

describe('UmovClient', () => {
  it('exige apiKey', () => {
    expect(() => new UmovClient({ apiKey: '' })).toThrow(/apiKey/)
  })

  it('expõe os recursos da Fase 1', () => {
    const { client } = makeClient()
    for (const r of ['agents', 'serviceLocals', 'schedules', 'activities', 'sections', 'sectionFields', 'activityHistories', 'geoCoordinates', 'customFields'] as const) {
      expect(client[r]).toBeDefined()
    }
  })

  it('agents.list bate no path /agent.xml', async () => {
    const { client, fetchMock } = makeClient()
    await client.agents.list({ active: true })
    const url = String(fetchMock.mock.calls[0]![0])
    expect(url).toContain('/k/agent.xml?active=true')
  })

  it('sections.list usa filtro pontuado', async () => {
    const { client, fetchMock } = makeClient()
    await client.sections.list({ 'activity.description': 'Vistoria' })
    expect(String(fetchMock.mock.calls[0]![0])).toContain('activity.description=Vistoria')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/client.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/client.ts`**

```ts
import { Transport, type TransportOptions } from './core/transport'
import { defineResource } from './core/resource'
import { createSchedulesResource, type SchedulesResource } from './resources/schedules'
import { createActivityHistoriesResource, type ActivityHistoriesResource } from './resources/activity-histories'
import { createCustomFieldsAccessor, type CustomFieldsAccessor } from './resources/custom-fields'
import type {
  Activity, ActivityFilters,
  Agent, AgentCreate, AgentFilters, AgentUpdate,
  GeoCoordinate, GeoCoordinateFilters,
  Section, SectionField, SectionFieldFilters, SectionFilters,
  ServiceLocal, ServiceLocalCreate, ServiceLocalFilters, ServiceLocalUpdate,
} from './resources/types'

export type UmovClientOptions = TransportOptions

export class UmovClient {
  readonly agents
  readonly serviceLocals
  readonly activities
  readonly sections
  readonly sectionFields
  readonly geoCoordinates
  readonly schedules: SchedulesResource
  readonly activityHistories: ActivityHistoriesResource
  readonly customFields: CustomFieldsAccessor

  constructor(options: UmovClientOptions) {
    if (!options.apiKey) throw new Error('UmovClient: apiKey é obrigatória')
    const transport = new Transport(options)

    this.agents = defineResource<Agent, AgentCreate, AgentUpdate, AgentFilters>(transport, { path: 'agent' })
    this.serviceLocals = defineResource<ServiceLocal, ServiceLocalCreate, ServiceLocalUpdate, ServiceLocalFilters>(transport, { path: 'serviceLocal' })
    // Read-only por limitação da API (spec §2): create/update existem no objeto mas a API retorna erro; não são expostos nos tipos.
    this.activities = readOnly(defineResource<Activity, never, never, ActivityFilters>(transport, { path: 'activity' }))
    this.sections = readOnly(defineResource<Section, never, never, SectionFilters>(transport, { path: 'section' }))
    this.sectionFields = readOnly(defineResource<SectionField, never, never, SectionFieldFilters>(transport, { path: 'sectionField' }))
    this.geoCoordinates = readOnly(defineResource<GeoCoordinate, never, never, GeoCoordinateFilters>(transport, { path: 'geoCoordinate' }))

    this.schedules = createSchedulesResource(transport)
    this.activityHistories = createActivityHistoriesResource(transport)
    this.customFields = createCustomFieldsAccessor(transport)
  }
}

/** Remove create/update da superfície pública de recursos somente leitura. */
function readOnly<T extends { create: unknown; update: unknown }>(resource: T): Omit<T, 'create' | 'update'> {
  const { create: _c, update: _u, ...rest } = resource
  return rest
}
```

Nota: este arquivo só compila depois das Tasks 13–15 (schedules, activity-histories, custom-fields). Se estiver executando as tasks em ordem e quiser o teste verde já, implemente as Tasks 13–15 primeiro e volte; a ordem recomendada de execução é 13 → 14 → 15 → 12. O plano mantém a Task 12 aqui porque define os contratos que as três seguintes implementam.

- [ ] **Step 4: Atualizar `src/index.ts`**

```ts
export { UmovClient, type UmovClientOptions } from './client'
export * from './core/errors'
export { type EntityRef, type ListPage, type ListStub, type RelationRef } from './core/types'
export * from './resources/types'
export { formatDate, formatDateTime } from './util/datetime'
```

- [ ] **Step 5: Rodar (depois das Tasks 13–15) e ver passar**

Run: `npx vitest run tests/client.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add src/client.ts src/index.ts tests/client.test.ts
git commit -m "feat: UmovClient com recursos da Fase 1"
```

---

### Task 13: `resources/schedules.ts` — schedules + cancel

**Files:**
- Create: `src/resources/schedules.ts`
- Test: `tests/resources/schedules.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createSchedulesResource } from '../../src/resources/schedules'
import { Transport } from '../../src/core/transport'

const writeXml = `<result><resourceName>schedule</resourceName><resourceId>42</resourceId></result>`

function make() {
  const fetchMock = vi.fn(async () => new Response(writeXml, { status: 200 }))
  const transport = new Transport({ apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch })
  return { schedules: createSchedulesResource(transport), fetchMock }
}

describe('schedules.create', () => {
  it('serializa date como YYYY-MM-DD', async () => {
    const { schedules, fetchMock } = make()
    await schedules.create({
      agent: { id: 1 }, serviceLocal: { alternativeIdentifier: 'L-1' },
      date: new Date(2026, 6, 15), hour: '09:00',
    })
    const body = decodeURIComponent(String((fetchMock.mock.calls[0]![1] as RequestInit).body)).replace(/^data=/, '')
    expect(body).toBe(
      '<schedule><agent><id>1</id></agent><serviceLocal><alternativeIdentifier>L-1</alternativeIdentifier></serviceLocal><date>2026-07-15</date><hour>09:00</hour></schedule>',
    )
  })
})

describe('schedules.cancel', () => {
  it('POSTa situation.id=70 no path do ref', async () => {
    const { schedules, fetchMock } = make()
    await schedules.cancel({ altId: 'OS-9' })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toContain('/schedule/alternativeIdentifier/OS-9.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe('<schedule><situation><id>70</id></situation></schedule>')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/resources/schedules.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { defineResource, type Resource } from '../core/resource'
import { formatDate } from '../util/datetime'
import type { EntityRef } from '../core/types'
import type { Transport } from '../core/transport'
import type { Schedule, ScheduleCreate, ScheduleFilters, ScheduleUpdate } from './types'

export interface SchedulesResource extends Resource<Schedule, ScheduleCreate, ScheduleUpdate, ScheduleFilters> {
  /**
   * Cancela a tarefa (POST situation.id=70).
   * A API rejeita se a tarefa já está executada (50) ou cancelada (70).
   */
  cancel(ref: EntityRef): Promise<void>
}

function normalizeDate<T extends { date?: Date | string }>(payload: T): T {
  if (payload.date instanceof Date) return { ...payload, date: formatDate(payload.date) }
  return payload
}

export function createSchedulesResource(transport: Transport): SchedulesResource {
  const base = defineResource<Schedule, ScheduleCreate, ScheduleUpdate, ScheduleFilters>(transport, { path: 'schedule' })
  return {
    ...base,
    create: (payload) => base.create(normalizeDate(payload)),
    update: (ref, payload) => base.update(ref, normalizeDate(payload)),
    cancel: (ref) => base.update(ref, { situation: { id: 70 } }),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/resources/schedules.test.ts`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/resources/schedules.ts tests/resources/schedules.test.ts
git commit -m "feat(resources): schedules com cancel e normalização de data"
```

---

### Task 14: `resources/activity-histories.ts` — leitura de dados coletados

Endpoints irregulares (spec §5): lista/detalhe padrão + `GET /activityHistoryHierarchical/{id}.xml` + `POST /schedule/{ref}/activityHistory.xml` + updates de aprovação/exportação.

**Files:**
- Create: `src/resources/activity-histories.ts`
- Test: `tests/resources/activity-histories.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createActivityHistoriesResource } from '../../src/resources/activity-histories'
import { Transport } from '../../src/core/transport'

const hierXml = `<activityHistory><id>5</id><status>50</status><activity><id>2</id><description>Vistoria</description></activity></activityHistory>`
const writeXml = `<result><resourceName>activityHistory</resourceName><resourceId>5</resourceId></result>`

function make(body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
  const transport = new Transport({ apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch })
  return { histories: createActivityHistoriesResource(transport), fetchMock }
}

describe('activityHistories.hierarchical', () => {
  it('busca a árvore completa no endpoint próprio', async () => {
    const { histories, fetchMock } = make(hierXml)
    const tree = await histories.hierarchical(5)
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/activityHistoryHierarchical/5.xml')
    expect(tree.id).toBe(5)
    expect((tree.activity as { description: string }).description).toBe('Vistoria')
  })
})

describe('activityHistories.createForSchedule', () => {
  it('POSTa no sub-path do schedule por altId', async () => {
    const { histories, fetchMock } = make(writeXml)
    await histories.createForSchedule({ altId: 'OS-1' }, { activity: { id: 2 } })
    const [url] = fetchMock.mock.calls[0]! as [string]
    expect(url).toContain('/schedule/alternativeIdentifier/OS-1/activityHistory.xml')
  })
})

describe('activityHistories.setApproval', () => {
  it('POSTa statusApproval no detalhe', async () => {
    const { histories, fetchMock } = make(writeXml)
    await histories.setApproval(5, 3)
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toContain('/activityHistory/5.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe('<activityHistory><statusApproval>3</statusApproval></activityHistory>')
  })
})

describe('activityHistories.setExportStatus', () => {
  it('POSTa executionExportStatus e exportFileName', async () => {
    const { histories, fetchMock } = make(writeXml)
    await histories.setExportStatus(5, { executionExportStatus: 'EXPORTED', exportFileName: 'lote1.csv' })
    const body = decodeURIComponent(String((fetchMock.mock.calls[0]![1] as RequestInit).body)).replace(/^data=/, '')
    expect(body).toBe(
      '<activityHistory><executionExportStatus>EXPORTED</executionExportStatus><exportFileName>lote1.csv</exportFileName></activityHistory>',
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/resources/activity-histories.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { defineResource } from '../core/resource'
import { parseDetailResponse, parseWriteResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { refToPath, type EntityRef, type ListPage, type ListStub } from '../core/types'
import type { IterateOptions, ListOptions } from '../core/resource'
import type { Transport } from '../core/transport'
import type { ActivityHistory, ActivityHistoryFilters, ActivityHistoryHierarchical } from './types'

export interface ActivityHistoryCreate {
  activity: { id: number } | { alternativeIdentifier: string }
  [key: string]: unknown
}

export interface ActivityHistoriesResource {
  /** Sem filtro de data a API retorna só os últimos 7 dias. */
  list(filters?: ActivityHistoryFilters, opts?: ListOptions): Promise<ListPage>
  iterate(filters?: ActivityHistoryFilters, opts?: IterateOptions & { hydrate: true }): AsyncGenerator<ActivityHistory>
  iterate(filters?: ActivityHistoryFilters, opts?: IterateOptions): AsyncGenerator<ListStub>
  get(ref: EntityRef): Promise<ActivityHistory>
  /** Árvore completa activity>sections>items>fields>geo — a base para gerar laudos. */
  hierarchical(id: number): Promise<ActivityHistoryHierarchical>
  /** Cria história via API (schedule precisa estar pendente de envio ou em campo; pula validações do mobile). */
  createForSchedule(scheduleRef: EntityRef, payload: ActivityHistoryCreate): Promise<{ id: number }>
  /** 3 = aprovado, 4 = rejeitado. Só funciona enquanto pendente de aprovação. */
  setApproval(id: number, status: 3 | 4): Promise<void>
  setExportStatus(id: number, opts: { executionExportStatus: string; exportFileName?: string }): Promise<void>
}

export function createActivityHistoriesResource(transport: Transport): ActivityHistoriesResource {
  const base = defineResource<ActivityHistory, never, Record<string, unknown>, ActivityHistoryFilters>(transport, {
    path: 'activityHistory',
  })
  return {
    list: base.list,
    iterate: base.iterate,
    get: base.get,
    async hierarchical(id) {
      const xml = await transport.get(`activityHistoryHierarchical/${id}.xml`)
      return parseDetailResponse<ActivityHistoryHierarchical>(xml, 'activityHistory')
    },
    async createForSchedule(scheduleRef, payload) {
      const xml = serializeEntity('activityHistory', payload as Record<string, never>)
      const res = parseWriteResponse(await transport.post(`schedule/${refToPath(scheduleRef)}/activityHistory.xml`, xml))
      return { id: res.id }
    },
    setApproval: (id, status) => base.update(id, { statusApproval: status }),
    setExportStatus: (id, opts) => base.update(id, { ...opts }),
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/resources/activity-histories.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Commit**

```bash
git add src/resources/activity-histories.ts tests/resources/activity-histories.test.ts
git commit -m "feat(resources): activityHistories com hierarchical, aprovação e exportação"
```

---

### Task 15: `resources/custom-fields.ts` — `customFields.of(entity, ref)`

Endpoints (spec §5): `GET /{entity}/{ref}/customField.xml` (lista valores) e `POST` no mesmo path para gravar valores. Multi-valor **substitui tudo** (aviso no TSDoc).

**Files:**
- Create: `src/resources/custom-fields.ts`
- Test: `tests/resources/custom-fields.test.ts`

- [ ] **Step 1: Escrever teste falhando**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createCustomFieldsAccessor } from '../../src/resources/custom-fields'
import { Transport } from '../../src/core/transport'

const listXml = `<result><size>1</size><entries><entry id="3" link="/agent/1/customField/3.xml"/></entries></result>`
const writeXml = `<result><resourceName>customField</resourceName><resourceId>3</resourceId></result>`

function make(body: string) {
  const fetchMock = vi.fn(async () => new Response(body, { status: 200 }))
  const transport = new Transport({ apiKey: 'k', requestsPerSecond: 1000, fetch: fetchMock as unknown as typeof fetch })
  return { customFields: createCustomFieldsAccessor(transport), fetchMock }
}

describe('customFields.of(...).list', () => {
  it('lista valores no sub-path da entidade', async () => {
    const { customFields, fetchMock } = make(listXml)
    await customFields.of('agent', 1).list()
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/agent/1/customField.xml')
  })

  it('aceita ref por altId', async () => {
    const { customFields, fetchMock } = make(listXml)
    await customFields.of('serviceLocal', { altId: 'L-1' }).list()
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/serviceLocal/alternativeIdentifier/L-1/customField.xml')
  })
})

describe('customFields.of(...).setValues', () => {
  it('POSTa customFields com nomes encodados e pipe', async () => {
    const { customFields, fetchMock } = make(writeXml)
    await customFields.of('agent', 1).setValues({ 'numero da nota': '42', regioes: ['0', '1'] })
    const [url, init] = fetchMock.mock.calls[0]! as [string, RequestInit]
    expect(url).toContain('/agent/1/customField.xml')
    const body = decodeURIComponent(String(init.body)).replace(/^data=/, '')
    expect(body).toBe(
      '<customFields><numero__da__nota>42</numero__da__nota><regioes>0|1</regioes></customFields>',
    )
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/resources/custom-fields.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
import { parseListResponse } from '../core/envelope'
import { serializeEntity } from '../core/xml'
import { refToPath, type EntityRef, type ListPage } from '../core/types'
import type { Transport } from '../core/transport'
import type { CustomFieldValues } from './types'

/** Entidades que suportam custom fields via API (doc uMov.me). */
export type CustomFieldOwner = 'agent' | 'serviceLocal' | 'item' | 'schedule' | 'team'

export interface EntityCustomFields {
  list(): Promise<ListPage>
  /**
   * Grava valores de custom fields.
   * ATENÇÃO: em campos multi-valorados a API SUBSTITUI todos os valores existentes.
   */
  setValues(values: CustomFieldValues): Promise<void>
}

export interface CustomFieldsAccessor {
  of(entity: CustomFieldOwner, ref: EntityRef): EntityCustomFields
}

export function createCustomFieldsAccessor(transport: Transport): CustomFieldsAccessor {
  return {
    of(entity, ref) {
      const basePath = `${entity}/${refToPath(ref)}/customField.xml`
      return {
        async list() {
          return parseListResponse(await transport.get(basePath))
        },
        async setValues(values) {
          await transport.post(basePath, serializeEntity('customFields', values))
        },
      }
    },
  }
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/resources/custom-fields.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 5: Voltar à Task 12 (client) se ainda não fechada**

Run: `npx vitest run tests/client.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/resources/custom-fields.ts tests/resources/custom-fields.test.ts
git commit -m "feat(resources): acessor de custom fields por entidade"
```

---

### Task 16: README, verificação final e build

**Files:**
- Create: `README.md`
- Modify: nenhum código (verificação)

- [ ] **Step 1: Criar `README.md`**

````markdown
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
```

## Comportamentos embutidos

- **Rate limit**: 4 req/s (limite da uMov.me) com retry/backoff automático em 429.
- **Token seguro**: a apiKey vai na URL (exigência da API), mas é redigida (`***`) em toda mensagem de erro e log.
- **Erros tipados**: `UmovAuthError` (401), `UmovNotFoundError` (404), `UmovValidationError` (400), `UmovRateLimitError` (429), `UmovApiNotEnabledError` (501), `UmovTimeoutError` (504).
- **Escaping**: CDATA + `%25`/`%26`, nomes de custom fields com `__`, multi-valores com pipe — tudo automático.

## Desenvolvimento

```bash
npm test          # vitest
npm run typecheck # tsc --noEmit
npm run build     # tsup → dist/
```

Spec e plano: `docs/superpowers/`. Referência da API extraída da doc oficial: `docs/api-map.json`.
````

- [ ] **Step 2: Verificação completa**

Run: `npx vitest run && npx tsc --noEmit && npx tsup`
Expected: todos os testes PASS (~48 testes), typecheck limpo, build gera `dist/`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README com quickstart e comportamentos embutidos"
```

---

## Self-Review (executado na escrita do plano)

- **Cobertura da spec (Fase 1):** core §4 completo (Tasks 2–10), recursos da Fase 1 §8 (Tasks 11–15), README (Task 16). `UmovClient.fromCredentials` é Fase 2 (spec R8) — fora deste plano. Validação dos riscos R2/R4/R5/R10 contra homolog exige token real — registrada como pendência pós-plano (não automatizável sem credencial).
- **Placeholders:** nenhum TBD/TODO; todo step de código mostra o código.
- **Consistência de tipos:** `createSchedulesResource`/`createActivityHistoriesResource`/`createCustomFieldsAccessor` (Tasks 13–15) batem com os imports da Task 12; `ListPage`/`ListStub` vivem em `core/types` (Task 3) e são reexportados; `filtersToQuery` usa `formatDateTime` da Task 4. Ordem de execução recomendada: 1→11, 13, 14, 15, 12, 16.
