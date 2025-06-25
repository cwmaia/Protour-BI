import { BaseSyncService, SyncResult } from './base.sync';
import { Condutor } from '../../types/api.types';
import logger from '../../utils/logger';
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

export class CondutoresSyncService extends BaseSyncService {
  constructor() {
    super('condutores');
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
        'codigo_condutor', 'codigo_cliente', 'nome_condutor', 'nome_mae', 'nome_pai',
        'numero_registro', 'orgao_emissor_habilitacao', 'categoria_habilitacao',
        'data_validade', 'data_primeira_habilitacao', 'numero_seguranca_cnh',
        'numero_cnh', 'codigo_municipio_emissor', 'estado', 'codigo_pais',
        'data_emissao', 'cpf', 'celular', 'telefone', 'email'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<Condutor>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoCondutor != null)
          .map(record => ({
            codigo_condutor: record.codigoCondutor,
            codigo_cliente: record.codigoCliente,
            nome_condutor: record.nomeCondutor,
            nome_mae: record.nomeMae,
            nome_pai: record.nomePai,
            numero_registro: record.numeroRegistro,
            orgao_emissor_habilitacao: record.orgaoEmissorHabilitacao,
            categoria_habilitacao: record.categoriaHabilitacao,
            data_validade: formatDateForMySQL(record.dataValidade),
            data_primeira_habilitacao: formatDateForMySQL(record.dataPrimeiraHabilitacao),
            numero_seguranca_cnh: record.numeroSegurancaCNH,
            numero_cnh: record.numeroCNH,
            codigo_municipio_emissor: record.codigoMunicipioEmissor,
            estado: record.estado,
            codigo_pais: record.codigoPais,
            data_emissao: formatDateForMySQL(record.dataEmissao),
            cpf: record.cpf,
            celular: record.celular,
            telefone: record.telefone,
            email: record.email
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'condutores',
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