import { defineResource, type ListOptions } from '../core/resource'
import { parseListResponse } from '../core/envelope'
import type { EntityRef, ListPage } from '../core/types'
import type { Transport } from '../core/transport'
import type { SimpleEntity, SimpleEntityFilters } from './types'

export interface ImportFilesResource {
  /**
   * Agenda arquivos JÁ PRESENTES no FTP do cliente para importação.
   * Vários nomes numa chamada formam um único pacote processado sequencialmente.
   */
  schedule(fileNames: string[]): Promise<void>
}

export interface ImportLayoutsResource {
  list(filters?: SimpleEntityFilters, opts?: ListOptions): Promise<ListPage>
  get(ref: EntityRef): Promise<SimpleEntity>
  /** Layouts de importação de uma entidade específica (ex.: 'item'). */
  byEntity(entity: string): Promise<ListPage>
}

export interface ExportLayoutsResource {
  list(filters?: SimpleEntityFilters, opts?: ListOptions): Promise<ListPage>
  get(ref: EntityRef): Promise<SimpleEntity>
}

const escapeAttr = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function createFileResources(transport: Transport): {
  importFiles: ImportFilesResource
  importLayouts: ImportLayoutsResource
  exportLayouts: ExportLayoutsResource
} {
  const importLayoutBase = defineResource<SimpleEntity, never, never, SimpleEntityFilters>(transport, {
    path: 'importLayout',
  })
  const exportLayoutBase = defineResource<SimpleEntity, never, never, SimpleEntityFilters>(transport, {
    path: 'exportLayout',
  })

  return {
    importFiles: {
      async schedule(fileNames) {
        if (fileNames.length === 0) throw new RangeError('Informe ao menos um arquivo para importar')
        // O corpo usa ATRIBUTO name (serializeEntity só emite elementos) — montado à mão com escape
        const entries = fileNames.map((n) => `<entry name="${escapeAttr(n)}"/>`).join('')
        await transport.post('importfiles.xml', `<import><files>${entries}</files></import>`)
      },
    },
    importLayouts: {
      list: importLayoutBase.list,
      get: importLayoutBase.get,
      async byEntity(entity) {
        return parseListResponse(await transport.get(`importLayout/entity/${encodeURIComponent(entity)}.xml`))
      },
    },
    exportLayouts: {
      list: exportLayoutBase.list,
      get: exportLayoutBase.get,
    },
  }
}
