import { BaseSyncService, SyncResult } from './base.sync';
import { Reserva } from '../../types/api.types';
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

export class ReservasSyncService extends BaseSyncService {
  constructor() {
    super('reservas');
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
        'codigo_reserva', 'codigo_empresa', 'codigo_unidade', 'codigo_cliente',
        'razao_social', 'codigo_grupo', 'codigo_mva', 'data_hora_inicio_prevista',
        'data_hora_termino_prevista', 'valor_previsto', 'status_reserva', 'observacoes',
        'criado_por', 'data_criacao', 'codigo_contrato_gerado'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<Reserva>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoReserva != null)
          .map(record => ({
            codigo_reserva: record.codigoReserva,
            codigo_empresa: record.codigoEmpresa,
            codigo_unidade: record.codigoUnidade,
            codigo_cliente: record.codigoCliente,
            razao_social: record.razaoSocial,
            codigo_grupo: record.codigoGrupo,
            codigo_mva: record.codigoMVA,
            data_hora_inicio_prevista: formatDateTimeForMySQL(record.dataHoraInicioPrevista),
            data_hora_termino_prevista: formatDateTimeForMySQL(record.dataHoraTerminoPrevista),
            valor_previsto: record.valorPrevisto,
            status_reserva: record.statusReserva,
            observacoes: record.observacoes,
            criado_por: record.criadoPor,
            data_criacao: formatDateTimeForMySQL(record.dataCriacao),
            codigo_contrato_gerado: record.codigoContratoGerado
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'reservas',
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