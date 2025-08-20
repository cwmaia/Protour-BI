import { BaseSyncService, SyncResult } from './base.sync';
import { DadosClienteBI } from '../../types/api.types';
import logger from '../../utils/logger';
import { format } from 'date-fns';
import { getEndpointForEntity } from '../../config/endpoints';

function formatDateForMySQL(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

export class DadosClientesSyncService extends BaseSyncService {
  constructor() {
    super('dados_clientes');
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
        'razao_social', 'descricao_unidade', 'numero_documento', 'data_emissao',
        'descricao_tipo_documento', 'valor_bruto', 'valor_documento', 'data_vencimento',
        'nome_fantasia', 'area_atuacao', 'previsao', 'valor_centro_receita',
        'descricao_centro_receita', 'codigo_forma_pagamento'
      ];

      // Get date range for sync (last 90 days by default)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const params = {
        dataInicio: format(startDate, 'yyyy-MM-dd'),
        dataFim: format(endDate, 'yyyy-MM-dd'),
        tipoConsulta: 'R' // Receivables
      };

      // Use pagination to fetch all client BI data
      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<DadosClienteBI>(
        endpoint,
        200,
        params
      );
      
      for await (const batch of pageGenerator) {
        logger.info(`Processing batch of ${batch.length} client records`);
        
        // Map API fields to database fields - skip records without razao_social
        const mappedRecords = batch
          .filter(record => record.razaoSocial != null && record.razaoSocial !== '')
          .map(record => ({
            razao_social: record.razaoSocial,
            descricao_unidade: record.descricaoUnidade,
            numero_documento: record.numeroDocumento,
            data_emissao: formatDateForMySQL(record.dataEmissao),
            descricao_tipo_documento: record.descricaoTipoDocumento,
            valor_bruto: record.valorBruto,
            valor_documento: record.valorDocumento,
            data_vencimento: formatDateForMySQL(record.dataVencimento),
            nome_fantasia: record.nomeFantasia,
            area_atuacao: record.areaAtuacao,
            previsao: record.previsao,
            valor_centro_receita: record.valorCentroReceita,
            descricao_centro_receita: record.descricaoCentroReceita,
            codigo_forma_pagamento: record.codigoFormaPagamento
          }));

        const inserted = await this.executeBatchInsert(
          'bi_dados_clientes',
          columns,
          mappedRecords,
          true // Use UPSERT: Update on duplicate key
        );

        totalRecords += inserted;
        logger.info(`Inserted ${inserted} client records`);
      }

      // Also sync for payments (tipoConsulta: 'P')
      params.tipoConsulta = 'P';
      const paymentPageGenerator = this.apiClient.paginate<DadosClienteBI>(
        endpoint,
        200,
        params
      );

      for await (const batch of paymentPageGenerator) {
        logger.info(`Processing batch of ${batch.length} payment records`);
        
        const mappedRecords = batch
          .filter(record => record.razaoSocial != null && record.razaoSocial !== '')
          .map(record => ({
            razao_social: record.razaoSocial,
            descricao_unidade: record.descricaoUnidade,
            numero_documento: record.numeroDocumento,
            data_emissao: formatDateForMySQL(record.dataEmissao),
            descricao_tipo_documento: record.descricaoTipoDocumento,
            valor_bruto: record.valorBruto,
            valor_documento: record.valorDocumento,
            data_vencimento: formatDateForMySQL(record.dataVencimento),
            nome_fantasia: record.nomeFantasia,
            area_atuacao: record.areaAtuacao,
            previsao: record.previsao,
            valor_centro_receita: record.valorCentroReceita,
            descricao_centro_receita: record.descricaoCentroReceita,
            codigo_forma_pagamento: record.codigoFormaPagamento
          }));

        const inserted = await this.executeBatchInsert(
          'bi_dados_clientes',
          columns,
          mappedRecords,
          true // Use UPSERT: Update on duplicate key
        );

        totalRecords += inserted;
        logger.info(`Inserted ${inserted} payment records`);
      }

      await this.updateSyncMetadata('completed', totalRecords);
      await this.logSyncAudit('full_sync', totalRecords, 'completed', startedAt, new Date());

      const duration = Date.now() - startTime;
      logger.info(`Sync completed for ${this.entityName}. Records: ${totalRecords}, Duration: ${duration}ms`);

      return {
        entity: this.entityName,
        recordsSynced: totalRecords,
        success: true,
        duration
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