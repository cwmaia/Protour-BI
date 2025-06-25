import { BaseSyncService, SyncResult } from './base.sync';
import { FormaPagamento } from '../../types/api.types';
import logger from '../../utils/logger';
import { getEndpointForEntity } from '../../config/endpoints';

export class FormasPagamentoSyncService extends BaseSyncService {
  constructor() {
    super('formas_pagamento');
  }

  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const startedAt = new Date();
    let totalRecords = 0;

    try {
      logger.info(`Starting sync for ${this.entityName}`);
      await this.updateSyncMetadata('running');
      await this.logSyncAudit('full_sync', 0, 'started', startedAt);

      const columns = [
        'codigo_forma_pagamento', 'descricao', 'tipo_pagamento', 'ativo',
        'prazo_dias', 'taxa_juros', 'desconto_percentual'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<FormaPagamento>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoFormaPagamento != null)
          .map(record => ({
            codigo_forma_pagamento: record.codigoFormaPagamento,
            descricao: record.descricao,
            tipo_pagamento: record.tipoPagamento,
            ativo: record.ativo,
            prazo_dias: record.prazoDias,
            taxa_juros: record.taxaJuros,
            desconto_percentual: record.descontoPercentual
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'formas_pagamento',
            columns,
            mappedRecords,
            true
          );
          totalRecords += inserted;
        }
      }

      await this.updateSyncMetadata('completed', totalRecords);
      await this.logSyncAudit('full_sync', totalRecords, 'completed', startedAt, new Date());

      return {
        entity: this.entityName,
        recordsSynced: totalRecords,
        success: true,
        duration: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Sync failed for ${this.entityName}:`, error);
      
      await this.updateSyncMetadata('failed', totalRecords, errorMessage);
      await this.logSyncAudit('full_sync', totalRecords, 'failed', startedAt, new Date(), errorMessage);

      return {
        entity: this.entityName,
        recordsSynced: totalRecords,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }
}