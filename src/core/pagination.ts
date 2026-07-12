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
