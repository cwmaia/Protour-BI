import { BaseSyncService, SyncResult } from './base.sync';
import { Veiculo } from '../../types/api.types';
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

export class VeiculosSyncService extends BaseSyncService {
  constructor() {
    super('veiculos');
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
        'codigo_mva', 'codigo_empresa', 'codigo_unidade', 'codigo_grupo', 'codigo_marca',
        'modelo', 'ano_modelo', 'ano_fabricacao', 'codigo_combustivel', 'cor', 'numero_chassi',
        'placa', 'renavam', 'numero_motor', 'codigo_categoria', 'capacidade_tanque',
        'hodometro', 'horimetro', 'ativo', 'codigo_modelo_fipe', 'nome_modelo_fipe',
        'numero_eixos', 'capacidade_carga', 'capacidade_passageiros', 'potencia_motor',
        'cilindrada_motor', 'data_compra', 'valor_compra', 'numero_nota_fiscal',
        'data_venda', 'valor_venda', 'motivo_venda'
      ];

      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<Veiculo>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        const mappedRecords = batch
          .filter(record => record.codigoMVA != null)
          .map(record => ({
            codigo_mva: record.codigoMVA,
            codigo_empresa: record.codigoEmpresa,
            codigo_unidade: record.codigoUnidade,
            codigo_grupo: record.codigoGrupo,
            codigo_marca: record.codigoMarca,
            modelo: record.modelo,
            ano_modelo: record.anoModelo,
            ano_fabricacao: record.anoFabricacao,
            codigo_combustivel: record.codigoCombustivel,
            cor: record.cor,
            numero_chassi: record.numeroChassi,
            placa: record.placa,
            renavam: record.renavam,
            numero_motor: record.numeroMotor,
            codigo_categoria: record.codigoCategoria,
            capacidade_tanque: record.capacidadeTanque,
            hodometro: record.hodometro,
            horimetro: record.horimetro,
            ativo: record.ativo,
            codigo_modelo_fipe: record.codigoModeloFipe,
            nome_modelo_fipe: record.nomeModeloFipe,
            numero_eixos: record.numeroEixos,
            capacidade_carga: record.capacidadeCarga,
            capacidade_passageiros: record.capacidadePassageiros,
            potencia_motor: record.potenciaMotor,
            cilindrada_motor: record.cilindradaMotor,
            data_compra: formatDateForMySQL(record.dataCompra),
            valor_compra: record.valorCompra,
            numero_nota_fiscal: record.numeroNotaFiscal,
            data_venda: formatDateForMySQL(record.dataVenda),
            valor_venda: record.valorVenda,
            motivo_venda: record.motivoVenda
          }));

        if (mappedRecords.length > 0) {
          const inserted = await this.executeBatchInsert(
            'veiculos',
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