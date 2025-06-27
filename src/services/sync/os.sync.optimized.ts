import { BaseSyncService, SyncResult } from './base.sync';
import { OS, OSDetail } from '../../types/api.types';
import logger from '../../utils/logger';
import { getEndpointForEntity } from '../../config/endpoints';
import { getConnection } from '../../config/database';
import { rateLimitManager } from '../rateLimitManager';
import cliProgress from 'cli-progress';
import chalk from 'chalk';

interface OSBatchStrategy {
  fetchDetails: boolean;
  batchSize: number;
  delayBetweenBatches: number;
  delayBetweenDetails: number;
  maxRetries: number;
}

export class OptimizedOsSyncService extends BaseSyncService {
  private strategies: {
    fast: OSBatchStrategy;
    balanced: OSBatchStrategy;
    detailed: OSBatchStrategy;
  };

  constructor() {
    super('os');
    
    // Define different sync strategies
    this.strategies = {
      // Fast: Sync basic OS data only, no details
      fast: {
        fetchDetails: false,
        batchSize: 200,
        delayBetweenBatches: 1000,
        delayBetweenDetails: 0,
        maxRetries: 3
      },
      // Balanced: Fetch details with smart batching
      balanced: {
        fetchDetails: true,
        batchSize: 50,
        delayBetweenBatches: 5000,
        delayBetweenDetails: 200,
        maxRetries: 5
      },
      // Detailed: Full sync with conservative rate limiting
      detailed: {
        fetchDetails: true,
        batchSize: 20,
        delayBetweenBatches: 10000,
        delayBetweenDetails: 500,
        maxRetries: 10
      }
    };
  }

  async sync(strategyName: 'fast' | 'balanced' | 'detailed' = 'balanced'): Promise<SyncResult> {
    const strategy = this.strategies[strategyName];
    const startTime = Date.now();
    const startedAt = new Date();
    let totalOsRecords = 0;
    let totalItemRecords = 0;
    let skippedDetails = 0;
    let rateLimitHits = 0;
    let progressBar: cliProgress.SingleBar | null = null;

    try {
      logger.info(`Starting OS sync with '${strategyName}' strategy`);
      await this.updateSyncMetadata('running');
      await this.logSyncAudit('full_sync', 0, 'started', startedAt);

      // Define columns
      const osColumns = [
        'codigo_os', 'codigo_empresa', 'codigo_unidade', 'data_abertura',
        'placa', 'codigo_fornecedor', 'numero_documento', 'valor_total', 'quantidade_itens'
      ];

      const itemColumns = [
        'codigo_os', 'numero_item', 'valor_item', 'quantidade', 'valor_total_item'
      ];

      // First, count total records for progress tracking
      const totalCount = await this.countTotalRecords();
      logger.info(`Total OS records to sync: ${totalCount}`);

      // Create progress bar if running interactively
      if (process.stdout.isTTY) {
        progressBar = new cliProgress.SingleBar({
          format: 'OS Sync |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | {rate} records/s | ETA: {eta}s',
          barCompleteChar: '\u2588',
          barIncompleteChar: '\u2591',
          hideCursor: true
        });
        progressBar.start(totalCount, 0);
      }

      // Use pagination to fetch OS records
      const endpoint = getEndpointForEntity(this.entityName);
      const pageGenerator = this.apiClient.paginate<OS>(endpoint, strategy.batchSize);
      
      let processedCount = 0;
      
      for await (const batch of pageGenerator) {
        const batchStartTime = Date.now();
        logger.info(`Processing batch of ${batch.length} OS records`);
        
        const osRecordsToInsert: any[] = [];
        const itemRecordsToInsert: any[] = [];

        // Process records in parallel with concurrency control
        const detailPromises = batch.map((os, index) => 
          this.processOsRecord(os, strategy, index, osRecordsToInsert, itemRecordsToInsert)
        );

        // Wait for all records in batch to be processed
        const results = await Promise.allSettled(detailPromises);
        
        // Count failures
        const failures = results.filter(r => r.status === 'rejected').length;
        if (failures > 0) {
          skippedDetails += failures;
          logger.warn(`Failed to fetch details for ${failures} records in this batch`);
        }

        // Insert OS records
        if (osRecordsToInsert.length > 0) {
          const insertedOs = await this.executeBatchInsert(
            'os',
            osColumns,
            osRecordsToInsert,
            true
          );
          totalOsRecords += insertedOs;
        }

        // Insert item records
        if (itemRecordsToInsert.length > 0) {
          const insertedItems = await this.executeBatchInsert(
            'os_itens',
            itemColumns,
            itemRecordsToInsert,
            true
          );
          totalItemRecords += insertedItems;
        }

        processedCount += batch.length;
        if (progressBar) {
          progressBar.update(processedCount);
        }

        // Check if we should slow down based on rate limit status
        const rateLimitStatuses = await rateLimitManager.getRateLimitStatus();
        const osRateLimit = rateLimitStatuses.find(s => s.endpoint === '/os');
        if (osRateLimit && osRateLimit.isLimited) {
          rateLimitHits++;
          const waitTime = Math.max(strategy.delayBetweenBatches * 2, 30000);
          logger.warn(`Rate limit detected, waiting ${waitTime}ms before next batch`);
          await this.delay(waitTime);
        } else {
          // Normal delay between batches
          await this.delay(strategy.delayBetweenBatches);
        }

        // Log batch performance
        const batchDuration = Date.now() - batchStartTime;
        logger.info(`Batch processed in ${batchDuration}ms, rate: ${(batch.length / (batchDuration / 1000)).toFixed(2)} records/s`);
      }

      if (progressBar) {
        progressBar.stop();
      }

      // Update aggregated vehicle expenses if we fetched details
      if (strategy.fetchDetails && totalItemRecords > 0) {
        await this.updateVehicleExpenses();
      }

      await this.updateSyncMetadata('completed', totalOsRecords);
      await this.logSyncAudit('full_sync', totalOsRecords, 'completed', startedAt, new Date());

      const duration = Date.now() - startTime;
      const summary = {
        strategy: strategyName,
        osRecords: totalOsRecords,
        itemRecords: totalItemRecords,
        skippedDetails,
        rateLimitHits,
        duration: (duration / 1000).toFixed(2) + 's',
        recordsPerSecond: (totalOsRecords / (duration / 1000)).toFixed(2)
      };

      logger.info('Sync completed successfully:', summary);

      return {
        entity: this.entityName,
        recordsSynced: totalOsRecords,
        success: true,
        duration,
        details: summary
      };
    } catch (error) {
      if (progressBar) {
        progressBar.stop();
      }

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

  private async processOsRecord(
    os: OS,
    strategy: OSBatchStrategy,
    index: number,
    osRecordsToInsert: any[],
    itemRecordsToInsert: any[]
  ): Promise<void> {
    // Add delay to avoid overwhelming the API
    if (strategy.fetchDetails && index > 0) {
      await this.delay(strategy.delayBetweenDetails * index);
    }

    let valorTotal = 0;
    let quantidadeItens = 0;

    if (strategy.fetchDetails) {
      try {
        const endpoint = getEndpointForEntity(this.entityName);
        const osDetail = await this.fetchWithRetry<OSDetail>(
          `${endpoint}/${os.codigoOS}`,
          strategy.maxRetries
        );

        if (osDetail.itens && Array.isArray(osDetail.itens)) {
          quantidadeItens = osDetail.itens.length;
          
          for (const item of osDetail.itens) {
            const itemValorTotal = (item.valorItem || 0) * (item.quantidade || 0);
            valorTotal += itemValorTotal;

            itemRecordsToInsert.push({
              codigo_os: os.codigoOS,
              numero_item: item.numeroItem,
              valor_item: item.valorItem || 0,
              quantidade: item.quantidade || 0,
              valor_total_item: itemValorTotal
            });
          }
        }
      } catch (error) {
        logger.debug(`Failed to fetch details for OS ${os.codigoOS}, using basic data`);
        // Use basic data if detail fetch fails
        valorTotal = os.valorTotal || 0;
        quantidadeItens = os.quantidadeItens || 0;
      }
    } else {
      // Fast strategy: use basic data only
      valorTotal = os.valorTotal || 0;
      quantidadeItens = os.quantidadeItens || 0;
    }

    osRecordsToInsert.push({
      codigo_os: os.codigoOS,
      codigo_empresa: os.codigoEmpresa,
      codigo_unidade: os.codigoUnidade,
      data_abertura: this.formatDateForMySQL(os.dataAbertura),
      placa: os.placa,
      codigo_fornecedor: os.codigoFornecedor,
      numero_documento: os.numeroDocumento,
      valor_total: valorTotal,
      quantidade_itens: quantidadeItens
    });
  }

  private async fetchWithRetry<T>(url: string, maxRetries: number): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.apiClient.get<T>(url);
      } catch (error) {
        lastError = error as Error;
        
        if (error instanceof Error && error.message.includes('429')) {
          const waitTime = Math.min(60000 * attempt, 300000); // Max 5 minutes
          logger.debug(`Rate limited on ${url}, waiting ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
          await this.delay(waitTime);
        } else if (attempt < maxRetries) {
          const waitTime = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
          await this.delay(waitTime);
        }
      }
    }
    
    throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} attempts`);
  }

  async countTotalRecords(): Promise<number> {
    let totalCount = 0;
    let page = 1;
    const endpoint = getEndpointForEntity(this.entityName);
    
    while (true) {
      const response = await this.apiClient.get<any>(endpoint, { pagina: page, linhas: 200 });
      const records = response?.results || response || [];
      const recordCount = Array.isArray(records) ? records.length : 0;
      
      totalCount += recordCount;
      
      if (recordCount < 200) {
        break;
      }
      
      page++;
    }
    
    return totalCount;
  }

  private formatDateForMySQL(dateString: string | null | undefined): string | null {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async updateVehicleExpenses(): Promise<void> {
    try {
      logger.info('Updating aggregated vehicle expenses');
      const pool = await getConnection();
      
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