import { BaseSyncService, SyncResult } from './base.sync';
import { ContratoMaster } from '../../types/api.types';
import logger from '../../utils/logger';
import { getEndpointForEntity } from '../../config/endpoints';

function formatDateTimeForMySQL(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 19).replace('T', ' ');
  } catch {
    return null;
  }
}

export class ContratoMasterSyncService extends BaseSyncService {
  constructor() {
    super('contratomaster');
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
        'codigo_contrato_master', 'codigo_empresa', 'codigo_unidade', 'codigo_cliente',
        'razao_social', 'email', 'telefone', 'data_hora_inicio', 'data_hora_termino',
        'tipo_contrato', 'valor_total', 'status_contrato', 'observacoes', 'criado_por',
        'data_criacao', 'atualizado_por', 'data_atualizacao'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<ContratoMaster>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoContratoMaster != null)
          .map(record => ({
            codigo_contrato_master: record.codigoContratoMaster,
            codigo_empresa: record.codigoEmpresa,
            codigo_unidade: record.codigoUnidade,
            codigo_cliente: record.codigoCliente,
            razao_social: record.razaoSocial,
            email: record.email,
            telefone: record.telefone,
            data_hora_inicio: formatDateTimeForMySQL(record.dataHoraInicio),
            data_hora_termino: formatDateTimeForMySQL(record.dataHoraTermino),
            tipo_contrato: record.tipoContrato,
            valor_total: record.valorTotal,
            status_contrato: record.statusContrato,
            observacoes: record.observacoes,
            criado_por: record.criadoPor,
            data_criacao: formatDateTimeForMySQL(record.dataCriacao),
            atualizado_por: record.atualizadoPor,
            data_atualizacao: formatDateTimeForMySQL(record.dataAtualizacao)
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'contrato_master',
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