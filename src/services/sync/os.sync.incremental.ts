import { BaseSyncService, SyncResult } from './base.sync';
import { OS, OSDetail } from '../../types/api.types';
import logger from '../../utils/logger';
import { getEndpointForEntity } from '../../config/endpoints';
import { getConnection } from '../../config/database';
import { osSyncConfig } from '../../config/osSync.config';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

interface SyncState {
  lastSyncDate?: Date;
  lastSyncOsId?: number;
  highestOsId?: number;
  totalSynced: number;
  totalDetailsSynced: number;
  syncStatus: 'idle' | 'running' | 'paused' | 'failed';
  currentPhase: 'headers' | 'details' | 'complete';
  lastError?: string;
}

interface SyncOptions {
  mode: 'full' | 'incremental' | 'resume' | 'details-only';
  fetchDetails: boolean;
  maxRecords?: number;
  dateFrom?: Date;
  dateTo?: Date;
  showProgress?: boolean;
}

export class IncrementalOsSyncService extends BaseSyncService {
  private requestCount = { minute: 0, hour: 0 };
  private lastMinuteReset = Date.now();
  private lastHourReset = Date.now();
  private progressBar: cliProgress.SingleBar | null = null;

  constructor() {
    super('os');
  }

  async sync(options: SyncOptions = { mode: 'incremental', fetchDetails: true }): Promise<SyncResult> {
    const startTime = Date.now();
    const startedAt = new Date();
    let totalOsRecords = 0;
    let totalItemRecords = 0;
    let skippedExisting = 0;

    try {
      logger.info(`Starting OS sync with mode: ${options.mode}`);
      
      // Load current sync state
      const syncState = await this.loadSyncState();
      
      // Update sync state to running
      await this.updateSyncState({ syncStatus: 'running' });
      await this.logSyncAudit(options.mode, 0, 'started', startedAt);

      // Phase 1: Sync Headers
      if (options.mode !== 'details-only') {
        const headerResult = await this.syncHeaders(options, syncState);
        totalOsRecords = headerResult.synced;
        skippedExisting = headerResult.skipped;
        
        // Update state after headers
        await this.updateSyncState({
          totalSynced: syncState.totalSynced + totalOsRecords,
          currentPhase: 'details'
        });
      }

      // Phase 2: Sync Details (if requested)
      if (options.fetchDetails) {
        const detailResult = await this.syncDetails(options, syncState);
        totalItemRecords = detailResult.itemsSynced;
        
        // Update state after details
        await this.updateSyncState({
          totalDetailsSynced: syncState.totalDetailsSynced + detailResult.detailsSynced,
          currentPhase: 'complete'
        });
      }

      // Update aggregated vehicle expenses
      if (totalItemRecords > 0) {
        await this.updateVehicleExpenses();
      }

      await this.updateSyncState({ syncStatus: 'idle' });
      await this.updateSyncMetadata('completed', totalOsRecords);
      await this.logSyncAudit(options.mode, totalOsRecords, 'completed', startedAt, new Date());

      const duration = Date.now() - startTime;
      logger.info(`OS sync completed. Headers: ${totalOsRecords}, Items: ${totalItemRecords}, Skipped: ${skippedExisting}, Duration: ${(duration/1000).toFixed(2)}s`);

      return {
        entity: this.entityName,
        recordsSynced: totalOsRecords,
        success: true,
        duration,
        details: {
          mode: options.mode,
          headersSync: totalOsRecords,
          itemsSync: totalItemRecords,
          skippedExisting,
          fetchedDetails: options.fetchDetails
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Sync failed for ${this.entityName}:`, error);
      
      await this.updateSyncState({ syncStatus: 'failed', lastError: errorMessage });
      await this.updateSyncMetadata('failed', totalOsRecords, errorMessage);
      await this.logSyncAudit(options.mode, totalOsRecords, 'failed', startedAt, new Date(), errorMessage);

      return {
        entity: this.entityName,
        recordsSynced: totalOsRecords,
        success: false,
        error: errorMessage,
        duration: Date.now() - startTime
      };
    } finally {
      if (this.progressBar) {
        this.progressBar.stop();
      }
    }
  }

  private async syncHeaders(options: SyncOptions, syncState: SyncState): Promise<{ synced: number, skipped: number }> {
    logger.info('Phase 1: Syncing OS headers');
    
    const pool = await getConnection();
    let totalSynced = 0;
    let totalSkipped = 0;
    
    // Determine starting point based on mode
    let startFromId = 0;
    if (options.mode === 'incremental' && syncState.highestOsId) {
      startFromId = syncState.highestOsId;
      logger.info(`Incremental sync from OS ID > ${startFromId}`);
    } else if (options.mode === 'resume' && syncState.lastSyncOsId) {
      startFromId = syncState.lastSyncOsId;
      logger.info(`Resuming sync from OS ID > ${startFromId}`);
    }

    // Get existing OS IDs to avoid re-syncing
    const [existingRows] = await pool.execute('SELECT codigo_os FROM os');
    const existingIds = new Set((existingRows as any[]).map(r => r.codigo_os));
    logger.info(`Found ${existingIds.size} existing OS records in database`);

    // Setup progress bar
    if (options.showProgress && process.stdout.isTTY) {
      this.progressBar = new cliProgress.SingleBar({
        format: 'OS Headers |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | {rate} records/s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
    }

    const endpoint = getEndpointForEntity(this.entityName);
    const config = osSyncConfig.headers;
    let page = 1;
    let hasMore = true;
    let processedCount = 0;

    while (hasMore && (!options.maxRecords || totalSynced < options.maxRecords)) {
      // Check rate limits
      await this.waitForRateLimit();

      try {
        // Fetch batch of headers
        const response = await this.apiClient.get<{ results: OS[] }>(endpoint, {
          pagina: page,
          linhas: config.batchSize
        });

        const records = response?.results || [];
        if (records.length === 0) {
          hasMore = false;
          break;
        }

        // Filter records based on mode
        const recordsToProcess = records.filter(os => {
          if (startFromId > 0 && os.codigoOS <= startFromId) {
            return false; // Skip already processed
          }
          if (options.dateFrom && os.dataAbertura && new Date(os.dataAbertura) < options.dateFrom) {
            return false; // Skip old dates
          }
          if (options.dateTo && os.dataAbertura && new Date(os.dataAbertura) > options.dateTo) {
            return false; // Skip future dates
          }
          return true;
        });

        // Separate new vs existing records
        const newRecords = recordsToProcess.filter(os => !existingIds.has(os.codigoOS));
        const existingRecords = recordsToProcess.filter(os => existingIds.has(os.codigoOS));

        totalSkipped += existingRecords.length;

        if (newRecords.length > 0) {
          // Insert new records
          const insertedCount = await this.insertOsHeaders(newRecords);
          totalSynced += insertedCount;
          
          // Queue for detail fetching
          await this.queueForDetails(newRecords.map(os => os.codigoOS));
          
          // Update highest OS ID
          const maxId = Math.max(...newRecords.map(os => os.codigoOS));
          await this.updateSyncState({ highestOsId: maxId, lastSyncOsId: maxId });
        }

        processedCount += records.length;
        if (this.progressBar) {
          this.progressBar.update(processedCount);
        }

        // Check if we got less than requested (end of data)
        if (records.length < config.batchSize) {
          hasMore = false;
        } else {
          page++;
          // Delay between batches
          await this.delay(config.delayMs);
        }

      } catch (error) {
        logger.error(`Error fetching OS headers page ${page}:`, error);
        if (error instanceof Error && error.message.includes('429')) {
          // Rate limited - wait longer
          await this.delay(osSyncConfig.rateLimits.cooldownMs);
        } else {
          throw error; // Re-throw other errors
        }
      }
    }

    logger.info(`Headers sync complete. New: ${totalSynced}, Skipped: ${totalSkipped}`);
    return { synced: totalSynced, skipped: totalSkipped };
  }

  private async syncDetails(options: SyncOptions, _syncState: SyncState): Promise<{ detailsSynced: number, itemsSynced: number }> {
    logger.info('Phase 2: Syncing OS details');
    
    const pool = await getConnection();
    let detailsSynced = 0;
    let itemsSynced = 0;

    // Get OS records that need detail sync
    const limit = options.maxRecords || osSyncConfig.incremental.maxRecordsPerRun;
    const [pendingRows] = await pool.execute(`
      SELECT codigo_os 
      FROM os 
      WHERE details_synced = FALSE 
      ORDER BY codigo_os 
      LIMIT ${limit}
    `);

    const pendingIds = (pendingRows as any[]).map(r => r.codigo_os);
    logger.info(`Found ${pendingIds.length} OS records needing detail sync`);

    if (pendingIds.length === 0) {
      return { detailsSynced: 0, itemsSynced: 0 };
    }

    // Setup progress for details
    if (this.progressBar) {
      this.progressBar.stop();
      this.progressBar = new cliProgress.SingleBar({
        format: 'OS Details |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | ETA: {eta}s',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      this.progressBar.start(pendingIds.length, 0);
    }

    const config = osSyncConfig.details;
    const endpoint = getEndpointForEntity(this.entityName);

    // Process in small batches
    for (let i = 0; i < pendingIds.length; i += config.batchSize) {
      const batchIds = pendingIds.slice(i, i + config.batchSize);
      
      // Check rate limits
      await this.waitForRateLimit();

      // Process each ID in the batch
      for (const osId of batchIds) {
        try {
          const osDetail = await this.apiClient.get<OSDetail>(`${endpoint}/${osId}`);
          
          if (osDetail.itens && Array.isArray(osDetail.itens)) {
            const itemsInserted = await this.insertOsItems(osId, osDetail.itens);
            itemsSynced += itemsInserted;
            
            // Mark as synced
            await pool.execute(
              'UPDATE os SET details_synced = TRUE, sync_attempted_at = NOW() WHERE codigo_os = ?',
              [osId]
            );
            detailsSynced++;
          }

          if (this.progressBar) {
            this.progressBar.update(i + batchIds.indexOf(osId) + 1);
          }

          // Small delay between individual requests
          await this.delay(500);

        } catch (error) {
          logger.error(`Failed to fetch details for OS ${osId}:`, error);
          
          // Mark as failed
          await pool.execute(
            'UPDATE os SET sync_attempted_at = NOW(), sync_error = ? WHERE codigo_os = ?',
            [error instanceof Error ? error.message : 'Unknown error', osId]
          );

          // Continue with next ID
          continue;
        }
      }

      // Longer delay between batches
      if (i + config.batchSize < pendingIds.length) {
        await this.delay(config.delayMs);
      }
    }

    logger.info(`Details sync complete. Details: ${detailsSynced}, Items: ${itemsSynced}`);
    return { detailsSynced, itemsSynced };
  }

  private async insertOsHeaders(records: OS[]): Promise<number> {
    const pool = await getConnection();
    const columns = [
      'codigo_os', 'codigo_empresa', 'codigo_unidade', 'data_abertura',
      'placa', 'codigo_fornecedor', 'numero_documento', 'valor_total', 'quantidade_itens'
    ];

    const values = records.map(os => [
      os.codigoOS,
      os.codigoEmpresa,
      os.codigoUnidade,
      os.dataAbertura ? new Date(os.dataAbertura).toISOString().split('T')[0] : null,
      os.placa,
      os.codigoFornecedor,
      os.numeroDocumento,
      os.valorTotal || 0,
      os.quantidadeItens || 0
    ]);

    const placeholders = records.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const flatValues = values.flat();

    const sql = `
      INSERT INTO os (${columns.join(', ')}) 
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE 
        updated_at = CURRENT_TIMESTAMP
    `;

    const [result] = await pool.execute(sql, flatValues);
    return (result as any).affectedRows || 0;
  }

  private async insertOsItems(osId: number, items: any[]): Promise<number> {
    const pool = await getConnection();
    // Don't include valor_total_item as it's a generated column
    const columns = ['codigo_os', 'numero_item', 'valor_item', 'quantidade'];

    const values = items.map(item => [
      osId,
      item.numeroItem,
      item.valorItem || 0,
      item.quantidade || 0
    ]);

    const placeholders = items.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
    const flatValues = values.flat();

    const sql = `
      INSERT INTO os_itens (${columns.join(', ')}) 
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE 
        valor_item = VALUES(valor_item),
        quantidade = VALUES(quantidade)
    `;

    const [result] = await pool.execute(sql, flatValues);
    return (result as any).affectedRows || 0;
  }

  private async queueForDetails(osIds: number[]): Promise<void> {
    const pool = await getConnection();
    const values = osIds.map(id => [id, 0]); // priority 0 for now
    const placeholders = osIds.map(() => '(?, ?)').join(', ');

    await pool.execute(
      `INSERT IGNORE INTO os_sync_queue (codigo_os, priority) VALUES ${placeholders}`,
      values.flat()
    );
  }

  private async loadSyncState(): Promise<SyncState> {
    const pool = await getConnection();
    const [rows] = await pool.execute('SELECT * FROM os_sync_state WHERE id = 1');
    
    if ((rows as any[]).length === 0) {
      // Initialize if not exists
      await pool.execute(`
        INSERT INTO os_sync_state (id, sync_status, current_phase) 
        VALUES (1, 'idle', 'headers')
      `);
      return {
        totalSynced: 0,
        totalDetailsSynced: 0,
        syncStatus: 'idle',
        currentPhase: 'headers'
      };
    }

    const state = (rows as any)[0];
    return {
      lastSyncDate: state.last_sync_date,
      lastSyncOsId: state.last_sync_os_id,
      highestOsId: state.highest_os_id,
      totalSynced: state.total_synced || 0,
      totalDetailsSynced: state.total_details_synced || 0,
      syncStatus: state.sync_status,
      currentPhase: state.current_phase,
      lastError: state.last_error
    };
  }

  private async updateSyncState(updates: Partial<SyncState>): Promise<void> {
    const pool = await getConnection();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.lastSyncDate !== undefined) {
      fields.push('last_sync_date = ?');
      values.push(updates.lastSyncDate);
    }
    if (updates.lastSyncOsId !== undefined) {
      fields.push('last_sync_os_id = ?');
      values.push(updates.lastSyncOsId);
    }
    if (updates.highestOsId !== undefined) {
      fields.push('highest_os_id = ?');
      values.push(updates.highestOsId);
    }
    if (updates.totalSynced !== undefined) {
      fields.push('total_synced = ?');
      values.push(updates.totalSynced);
    }
    if (updates.totalDetailsSynced !== undefined) {
      fields.push('total_details_synced = ?');
      values.push(updates.totalDetailsSynced);
    }
    if (updates.syncStatus !== undefined) {
      fields.push('sync_status = ?');
      values.push(updates.syncStatus);
    }
    if (updates.currentPhase !== undefined) {
      fields.push('current_phase = ?');
      values.push(updates.currentPhase);
    }
    if (updates.lastError !== undefined) {
      fields.push('last_error = ?');
      values.push(updates.lastError);
    }

    if (fields.length > 0) {
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(1); // id = 1

      await pool.execute(
        `UPDATE os_sync_state SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const config = osSyncConfig.rateLimits;

    // Reset counters if needed
    if (now - this.lastMinuteReset > 60000) {
      this.requestCount.minute = 0;
      this.lastMinuteReset = now;
    }
    if (now - this.lastHourReset > 3600000) {
      this.requestCount.hour = 0;
      this.lastHourReset = now;
    }

    // Check if we need to wait
    if (this.requestCount.minute >= config.requestsPerMinute) {
      const waitTime = 60000 - (now - this.lastMinuteReset);
      if (waitTime > 0) {
        logger.info(`Rate limit: waiting ${(waitTime/1000).toFixed(1)}s for minute limit`);
        await this.delay(waitTime);
        this.requestCount.minute = 0;
        this.lastMinuteReset = Date.now();
      }
    }

    if (this.requestCount.hour >= config.requestsPerHour) {
      const waitTime = 3600000 - (now - this.lastHourReset);
      if (waitTime > 0) {
        logger.info(`Rate limit: waiting ${(waitTime/60000).toFixed(1)}m for hour limit`);
        await this.delay(waitTime);
        this.requestCount.hour = 0;
        this.lastHourReset = Date.now();
      }
    }

    // Increment counters
    this.requestCount.minute++;
    this.requestCount.hour++;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected async updateVehicleExpenses(): Promise<void> {
    // Same implementation as before
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