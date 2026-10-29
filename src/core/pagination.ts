import type { ListPage, ListStub } from './types'

/**
 * Tamanhos de página que a uMov.me permite configurar por AMBIENTE. A doc pública fala em "máximo 100",
 * mas o valor real depende da configuração do cliente — e `<size>` na resposta é o tamanho da página
 * recebida, não o total de registros (validado contra a API real em 2026-10-29).
 */
export const KNOWN_PAGE_SIZES: readonly number[] = [25, 50, 100]

/** @deprecated o tamanho de página é configuração do ambiente; use `pageSize` em UmovClient. */
export const PAGE_SIZE = 100

/**
 * Auto-paginação: pede paging.page=1,2,... e para na última página.
 *
 * - `pageSize` informado (config do ambiente): para na primeira página com menos entradas que isso.
 * - Sem `pageSize` (auto): uma página vazia encerra; uma página com tamanho fora de KNOWN_PAGE_SIZES
 *   é certamente a última; e uma página menor que a primeira também é a última. O custo do modo auto
 *   é no máximo UMA requisição extra (quando a primeira página tem exatamente 25/50/100 registros e
 *   coincide com o fim dos dados).
 */
export async function* iterateStubs(
  fetchPage: (page: number) => Promise<ListPage>,
  pageSize?: number,
): AsyncGenerator<ListStub> {
  let firstLength: number | undefined
  for (let page = 1; ; page++) {
    const { entries } = await fetchPage(page)
    for (const entry of entries) yield entry
    if (entries.length === 0) return
    if (pageSize !== undefined) {
      if (entries.length < pageSize) return
      continue
    }
    if (!KNOWN_PAGE_SIZES.includes(entries.length)) return
    if (firstLength === undefined) firstLength = entries.length
    else if (entries.length < firstLength) return
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
  try {
    for await (const stub of stubs) {
      window.push(get(stub.id))
      if (window.length >= prefetch) yield await window.shift()!
    }
    while (window.length > 0) yield await window.shift()!
  } finally {
    // Ao abortar (erro ou return antecipado), observa as promises restantes da janela
    // para não derrubar o processo com unhandledRejection.
    await Promise.allSettled(window)
  }
}
