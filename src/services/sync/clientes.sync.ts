import { BaseSyncService, SyncResult } from './base.sync';
import { Cliente } from '../../types/api.types';
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

export class ClientesSyncService extends BaseSyncService {
  constructor() {
    super('clientes');
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
        'codigo_cliente', 'codigo_empresa', 'codigo_unidade', 'codigo_forma_pagamento',
        'razao_social', 'nome_fantasia', 'cnpj', 'cpf', 'ie', 'rg', 'orgao_emissor',
        'complemento_identidade', 'sexo', 'email', 'celular', 'telefone', 'data_nascimento',
        'nome_pai', 'nome_mae', 'tipo_pessoa', 'area_atuacao', 'numero_funcionarios',
        'porte_empresa', 'faturamento_anual', 'website', 'observacoes'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<Cliente>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoCliente != null)
          .map(record => ({
            codigo_cliente: record.codigoCliente,
            codigo_empresa: record.codigoEmpresa,
            codigo_unidade: record.codigoUnidade,
            codigo_forma_pagamento: record.codigoFormaPagamento,
            razao_social: record.razaoSocial,
            nome_fantasia: record.nomeFantasia,
            cnpj: record.cnpj,
            cpf: record.cpf,
            ie: record.ie,
            rg: record.rg,
            orgao_emissor: record.orgaoEmissor,
            complemento_identidade: record.complementoIdentidade,
            sexo: record.sexo,
            email: record.email,
            celular: record.celular,
            telefone: record.telefone,
            data_nascimento: formatDateForMySQL(record.dataNascimento),
            nome_pai: record.nomePai,
            nome_mae: record.nomeMae,
            tipo_pessoa: record.tipoPessoa,
            area_atuacao: record.areaAtuacao,
            numero_funcionarios: record.numeroFuncionarios,
            porte_empresa: record.porteEmpresa,
            faturamento_anual: record.faturamentoAnual,
            website: record.website,
            observacoes: record.observacoes
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'clientes',
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