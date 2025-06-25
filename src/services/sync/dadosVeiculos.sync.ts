import { BaseSyncService, SyncResult } from './base.sync';
import { DadosVeiculoBI } from '../../types/api.types';
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

export class DadosVeiculosSyncService extends BaseSyncService {
  constructor() {
    super('dados_veiculos');
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
        'placa', 'codigo_mva', 'chassi', 'renavam', 'codigo_empresa', 'codigo_unidade',
        'descricao_unidade', 'codigo_marca', 'marca_veiculo', 'modelo', 'ano_modelo',
        'letra', 'descricao_grupo', 'valor_compra', 'status', 'data_compra', 'nf_compra',
        'valor_entrada', 'data_venda', 'valor_venda', 'dias_em_posse', 'codigo_fipe',
        'valor_fipe', 'numero_contrato_alienacao', 'inicio_financiamento',
        'valor_compra_veiculo', 'valor_total_compra_veiculo', 'valor_alienado',
        'valor_media_parcela_alienacao', 'valor_total_alienacao_quitado',
        'valor_total_alienacao_aberto', 'numero_parcelas_total', 'quantidade_parcelas_quitadas',
        'quantidade_parcelas_abertas', 'valor_media_parcela_do_veiculo', 'financiado_por',
        'primeiro_vencimento', 'ultimo_vencimento', 'situacao_contrato_alienacao',
        'razao_social', 'nome_fantasia', 'veiculo_substituido', 'contrato_master',
        'data_inicio_contrato', 'data_termino_contrato', 'periodo_locacao_master',
        'ultimo_contrato', 'periodo_locacao_veiculo', 'total_recebido', 'parcelas_recebidas',
        'total_a_receber', 'parcelas_a_receber', 'valor_tarifa_locacao_atual'
      ];

      // Use pagination to fetch all vehicle BI data
      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<DadosVeiculoBI>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        logger.info(`Processing batch of ${batch.length} vehicles`);
        
        // Map API fields to database fields
        const mappedRecords = batch.map(record => ({
          placa: record.placa,
          codigo_mva: record.codigoMVA,
          chassi: record.chassi,
          renavam: record.renavam,
          codigo_empresa: record.codigoEmpresa,
          codigo_unidade: record.codigoUnidade,
          descricao_unidade: record.descricaoUnidade,
          codigo_marca: record.codigoMarca,
          marca_veiculo: record.marcaVeiculo,
          modelo: record.modelo,
          ano_modelo: record.anoModelo,
          letra: record.letra,
          descricao_grupo: record.descricaoGrupo,
          valor_compra: record.valorCompra,
          status: record.status,
          data_compra: formatDateForMySQL(record.dataCompra),
          nf_compra: record.nfCompra,
          valor_entrada: record.valorEntrada,
          data_venda: formatDateForMySQL(record.dataVenda),
          valor_venda: record.valorVenda,
          dias_em_posse: record.diasEmPosse,
          codigo_fipe: record.codigoFipe,
          valor_fipe: record.valorFipe,
          numero_contrato_alienacao: record.numeroContratoAlienacao,
          inicio_financiamento: formatDateForMySQL(record.inicioFinanciamento),
          valor_compra_veiculo: record.valorCompraVeiculo,
          valor_total_compra_veiculo: record.valorTotalCompraVeiculo,
          valor_alienado: record.valorAlienado,
          valor_media_parcela_alienacao: record.valorMediaParcelaAlienacao,
          valor_total_alienacao_quitado: record.valorTotalAlienacaoQuitado,
          valor_total_alienacao_aberto: record.valorTotalAlienacaoAberto,
          numero_parcelas_total: record.numeroParcelasTotal,
          quantidade_parcelas_quitadas: record.quantidadeParcelasQuitadas,
          quantidade_parcelas_abertas: record.quantidadeParcelasAbertas,
          valor_media_parcela_do_veiculo: record.valorMediaParcelaDoVeiculo,
          financiado_por: record.financiadoPor,
          primeiro_vencimento: formatDateForMySQL(record.primeiroVencimento),
          ultimo_vencimento: formatDateForMySQL(record.ultimoVencimento),
          situacao_contrato_alienacao: record.situacaoContratoAlienacao,
          razao_social: record.razaoSocial,
          nome_fantasia: record.nomeFantasia,
          veiculo_substituido: record.veiculoSubstituido,
          contrato_master: record.contratoMaster,
          data_inicio_contrato: formatDateForMySQL(record.dataInicioContrato),
          data_termino_contrato: formatDateForMySQL(record.dataTerminoContrato),
          periodo_locacao_master: record.periodoLocacaoMaster,
          ultimo_contrato: record.ultimoContrato,
          periodo_locacao_veiculo: record.periodoLocacaoVeiculo,
          total_recebido: record.totalRecebido,
          parcelas_recebidas: record.parcelasRecebidas,
          total_a_receber: record.totalAReceber,
          parcelas_a_receber: record.parcelasAReceber,
          valor_tarifa_locacao_atual: record.valorTarifaLocacaoAtual
        }));

        const inserted = await this.executeBatchInsert(
          'bi_dados_veiculos',
          columns,
          mappedRecords,
          false // Don't update on duplicate, append new records
        );

        totalRecords += inserted;
        logger.info(`Inserted ${inserted} vehicle records`);
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