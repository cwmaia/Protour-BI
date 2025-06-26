import { BaseSyncService, SyncResult } from './base.sync';
import { OS, OSDetail } from '../../types/api.types';
import logger from '../../utils/logger';
import { getEndpointForEntity } from '../../config/endpoints';
import { getConnection } from '../../config/database';

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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class OsSyncService extends BaseSyncService {
  private detailFetchDelay: number = 500; // 500ms delay between detail fetches

  constructor() {
    super('os');
  }

  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const startedAt = new Date();
    let totalOsRecords = 0;
    let totalItemRecords = 0;

    try {
      logger.info(`Starting sync for ${this.entityName}`);
      await this.updateSyncMetadata('running');
      await this.logSyncAudit('full_sync', 0, 'started', startedAt);

      // Define columns for OS table
      const osColumns = [
        'codigo_os', 'codigo_empresa', 'codigo_unidade', 'data_abertura',
        'placa', 'codigo_fornecedor', 'numero_documento', 'valor_total', 'quantidade_itens'
      ];

      // Define columns for OS items table
      const itemColumns = [
        'codigo_os', 'numero_item', 'valor_item', 'quantidade'
      ];

      // Use pagination to fetch all OS records
      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<OS>(endpoint, 200);
      
      for await (const batch of pageGenerator) {
        logger.info(`Processing batch of ${batch.length} OS records`);
        
        // Process each OS record
        const osRecordsToInsert = [];
        const itemRecordsToInsert = [];

        for (const os of batch) {
          // Fetch detail for each OS to get items
          try {
            logger.debug(`Fetching details for OS ${os.codigoOS}`);
            const osDetail = await this.apiClient.get<OSDetail>(`${endpoint}/${os.codigoOS}`);

            // Calculate total value and item count
            let valorTotal = 0;
            let quantidadeItens = 0;

            if (osDetail.itens && Array.isArray(osDetail.itens)) {
              quantidadeItens = osDetail.itens.length;
              
              // Process items
              for (const item of osDetail.itens) {
                const itemValorTotal = (item.valorItem || 0) * (item.quantidade || 0);
                valorTotal += itemValorTotal;

                itemRecordsToInsert.push({
                  codigo_os: os.codigoOS,
                  numero_item: item.numeroItem,
                  valor_item: item.valorItem || 0,
                  quantidade: item.quantidade || 0
                });
              }
            }

            // Map OS data
            osRecordsToInsert.push({
              codigo_os: os.codigoOS,
              codigo_empresa: os.codigoEmpresa,
              codigo_unidade: os.codigoUnidade,
              data_abertura: formatDateForMySQL(os.dataAbertura),
              placa: os.placa,
              codigo_fornecedor: os.codigoFornecedor,
              numero_documento: os.numeroDocumento,
              valor_total: valorTotal,
              quantidade_itens: quantidadeItens
            });

            // Apply rate limiting delay
            await delay(this.detailFetchDelay);

          } catch (error) {
            logger.error(`Failed to fetch details for OS ${os.codigoOS}:`, error);
            // Continue with basic OS data even if detail fetch fails
            osRecordsToInsert.push({
              codigo_os: os.codigoOS,
              codigo_empresa: os.codigoEmpresa,
              codigo_unidade: os.codigoUnidade,
              data_abertura: formatDateForMySQL(os.dataAbertura),
              placa: os.placa,
              codigo_fornecedor: os.codigoFornecedor,
              numero_documento: os.numeroDocumento,
              valor_total: os.valorTotal || 0,
              quantidade_itens: os.quantidadeItens || 0
            });
          }
        }

        // Insert OS records
        if (osRecordsToInsert.length > 0) {
          const insertedOs = await this.executeBatchInsert(
            'os',
            osColumns,
            osRecordsToInsert,
            true // Update on duplicate
          );
          totalOsRecords += insertedOs;
          logger.info(`Inserted ${insertedOs} OS records`);
        }

        // Insert item records
        if (itemRecordsToInsert.length > 0) {
          const insertedItems = await this.executeBatchInsert(
            'os_itens',
            itemColumns,
            itemRecordsToInsert,
            true // Update on duplicate
          );
          totalItemRecords += insertedItems;
          logger.info(`Inserted ${insertedItems} OS item records`);
        }
      }

      // Update aggregated vehicle expenses
      await this.updateVehicleExpenses();

      await this.updateSyncMetadata('completed', totalOsRecords);
      await this.logSyncAudit('full_sync', totalOsRecords, 'completed', startedAt, new Date());

      const duration = Date.now() - startTime;
      logger.info(`Sync completed for ${this.entityName}. OS Records: ${totalOsRecords}, Item Records: ${totalItemRecords}, Duration: ${duration}ms`);

      return {
        entity: this.entityName,
        recordsSynced: totalOsRecords,
        success: true,
        duration
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Sync failed for ${this.entityName}:`, error);
      
      await this.updateSyncMetadata('failed', totalOsRecords, errorMessage);
      await this.logSyncAudit('full_sync', totalOsRecords, 'failed', startedAt, new Date(), errorMessage);

      return {
        entity: this.entityName,
        recordsSynced: totalOsRecords,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      };
    }
  }

  protected async updateVehicleExpenses(): Promise<void> {
    try {
      logger.info('Updating aggregated vehicle expenses');
      const pool = await getConnection();
      
      // Update bi_vehicle_expenses table with aggregated data
      const updateQuery = `
        INSERT INTO bi_vehicle_expenses (
          placa, codigo_mva, total_expenses, expense_count,
          first_expense_date, last_expense_date, avg_expense_value,
          max_expense_value, total_items
        )
        SELECT 
          o.placa,
          v.codigo_mva,
          SUM(oi.valor_total_item) as total_expenses,
          COUNT(DISTINCT o.codigo_os) as expense_count,
          MIN(o.data_abertura) as first_expense_date,
          MAX(o.data_abertura) as last_expense_date,
          AVG(oi.valor_total_item) as avg_expense_value,
          MAX(oi.valor_total_item) as max_expense_value,
          COUNT(oi.id) as total_items
        FROM os o
        INNER JOIN os_itens oi ON o.codigo_os = oi.codigo_os
        LEFT JOIN veiculos v ON o.placa = v.placa
        WHERE o.placa IS NOT NULL
        GROUP BY o.placa, v.codigo_mva
        ON DUPLICATE KEY UPDATE
          codigo_mva = VALUES(codigo_mva),
          total_expenses = VALUES(total_expenses),
          expense_count = VALUES(expense_count),
          first_expense_date = VALUES(first_expense_date),
          last_expense_date = VALUES(last_expense_date),
          avg_expense_value = VALUES(avg_expense_value),
          max_expense_value = VALUES(max_expense_value),
          total_items = VALUES(total_items),
          last_updated = CURRENT_TIMESTAMP
      `;

      const [result] = await pool.execute(updateQuery);
      logger.info(`Updated vehicle expenses for ${(result as any).affectedRows} vehicles`);
    } catch (error) {
      logger.error('Failed to update vehicle expenses:', error);
      throw error;
    }
  }
}