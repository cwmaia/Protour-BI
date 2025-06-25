import { BaseSyncService, SyncResult } from './base.sync';
import { Contrato } from '../../types/api.types';
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

export class ContratosSyncService extends BaseSyncService {
  constructor() {
    super('contratos');
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
        'codigo_contrato', 'codigo_empresa', 'codigo_unidade', 'codigo_grupo_contratos',
        'codigo_mva', 'tipo_tarifa', 'periodo_tarifa', 'valor_km_rodado', 'franquia_km_rodado',
        'valor_locacao', 'data_hora_inicio_real', 'data_hora_termino_real', 'data_fecham_contrato',
        'usuario_abertura_contrato', 'codigo_condutor', 'inserido_por', 'codigo_cliente',
        'razao_social', 'email', 'celular', 'codigo_contrato_original', 'codigo_contrato_prox',
        'fechado', 'fechamento_nao_realizado_faturamento_master'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<Contrato>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoContrato != null)
          .map(record => ({
            codigo_contrato: record.codigoContrato,
            codigo_empresa: record.codigoEmpresa,
            codigo_unidade: record.codigoUnidade,
            codigo_grupo_contratos: record.codigoGrupoContratos,
            codigo_mva: record.codigoMVA,
            tipo_tarifa: record.tipoTarifa,
            periodo_tarifa: record.periodoTarifa,
            valor_km_rodado: record.valorKmRodado,
            franquia_km_rodado: record.franquiaKmRodado,
            valor_locacao: record.valorLocacao,
            data_hora_inicio_real: formatDateTimeForMySQL(record.dataHoraInicioReal),
            data_hora_termino_real: formatDateTimeForMySQL(record.dataHoraTerminoReal),
            data_fecham_contrato: formatDateTimeForMySQL(record.dataFechamContrato),
            usuario_abertura_contrato: record.usuarioAberturaContrato,
            codigo_condutor: record.codigoCondutor,
            inserido_por: record.inseridoPor,
            codigo_cliente: record.codigoCliente,
            razao_social: record.razaoSocial,
            email: record.email,
            celular: record.celular,
            codigo_contrato_original: record.codigoContratoOriginal,
            codigo_contrato_prox: record.codigoContratoProx,
            fechado: record.fechado,
            fechamento_nao_realizado_faturamento_master: record.fechamentoNaoRealizadoFaturamentoMaster
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'contratos',
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