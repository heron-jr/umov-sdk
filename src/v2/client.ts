import { UmovConfigError } from '../core/errors'
import { TransportV2, type TransportV2Options } from './transport'

export type UmovV2Options = TransportV2Options

/**
 * Cliente da API 2.0 (JSON). Só escrita: a v2 não tem GET — leia pela v1 (`UmovClient`).
 * Usado por `umov.v2` ou avulso: `new UmovV2Client({ appId, appKey })`.
 */
export class UmovV2Client {
  /** Transporte JSON — exposto para quem precisar chamar um path ainda não mapeado pelo SDK. */
  readonly transport: TransportV2

  constructor(options: UmovV2Options) {
    if (options.appId === undefined || options.appId === '' || !options.appKey) {
      throw new UmovConfigError('UmovV2Client: appId e appKey são obrigatórios')
    }
    this.transport = new TransportV2(options)
  }
}
