import { DadosVeiculosSyncService } from './sync/dadosVeiculos.sync';
import { DadosClientesSyncService } from './sync/dadosClientes.sync';
import { ClientesSyncService } from './sync/clientes.sync';
import { VeiculosSyncService } from './sync/veiculos.sync';
import { CondutoresSyncService } from './sync/condutores.sync';
import { ContratosSyncService } from './sync/contratos.sync';
import { ContratoMasterSyncService } from './sync/contratoMaster.sync';
import { ReservasSyncService } from './sync/reservas.sync';
import { FormasPagamentoSyncService } from './sync/formasPagamento.sync';
import { IncrementalOsSyncService } from './sync/os.sync.incremental';
import { SyncResult } from './sync/base.sync';
import logger from '../utils/logger';
import { getConnection } from '../config/database';
import { MultiProgressBar } from '../utils/progressBar';
export class SyncOrchestrator {
  private syncServices: Map<string, any> = new Map();
  private progressBar: MultiProgressBar | null = null;

  constructor() {
    // Register all sync services - BI tables first (priority)
    this.syncServices.set('dados_veiculos', new DadosVeiculosSyncService());
    this.syncServices.set('dados_clientes', new DadosClientesSyncService());
    
    // Then regular tables
    this.syncServices.set('formas_pagamento', new FormasPagamentoSyncService());
    this.syncServices.set('clientes', new ClientesSyncService());
    this.syncServices.set('veiculos', new VeiculosSyncService());
    this.syncServices.set('condutores', new CondutoresSyncService());
    this.syncServices.set('contratos', new ContratosSyncService());
    this.syncServices.set('contratomaster', new ContratoMasterSyncService());
    this.syncServices.set('reservas', new ReservasSyncService());
    this.syncServices.set('os', new IncrementalOsSyncService());
  }

  async estimateTotalRecords(): Promise<Map<string, number>> {
    const estimates = new Map<string, number>();
    
    // These are rough estimates - can be refined based on actual API responses
    estimates.set('dados_veiculos', 1000);
    estimates.set('dados_clientes', 2000);
    estimates.set('formas_pagamento', 50);
    estimates.set('clientes', 500);
    estimates.set('veiculos', 800);
    estimates.set('condutores', 300);
    estimates.set('contratos', 1500);
    estimates.set('contratomaster', 200);
    estimates.set('reservas', 400);
    estimates.set('os', 1000);
    
    return estimates;
  }

  async syncAll(showProgress: boolean = true): Promise<SyncResult[]> {
    logger.info('Starting full synchronization of all entities');
    const results: SyncResult[] = [];
    
    if (showProgress) {
      this.progressBar = new MultiProgressBar();
      const estimates = await this.estimateTotalRecords();
      
      // Initialize progress bars
      for (const [entityName, estimatedCount] of estimates) {
        this.progressBar.addBar(entityName, estimatedCount);
      }
    }
    
    for (const [entityName, service] of this.syncServices) {
      try {
        if (this.progressBar) {
          this.progressBar.update(entityName, 0, 'running');
        }
        
        logger.info(`Syncing entity: ${entityName}`);
        
        // Create a wrapper to track progress
        const originalExecuteBatch = service.executeBatchInsert;
        let recordsProcessed = 0;
        
        service.executeBatchInsert = async (...args: any[]) => {
          const result = await originalExecuteBatch.apply(service, args);
          recordsProcessed += result;
          
          if (this.progressBar) {
            this.progressBar.update(entityName, recordsProcessed, 'running');
          }
          
          return result;
        };
        
        // Special handling for OS sync which needs options
        let result: SyncResult;
        if (entityName === 'os' && service instanceof IncrementalOsSyncService) {
          result = await service.sync({ 
            mode: 'incremental', 
            fetchDetails: true,
            showProgress: false // We handle progress ourselves
          });
        } else {
          result = await service.sync();
        }
        results.push(result);
        
        if (this.progressBar) {
          if (result.success) {
            this.progressBar.complete(entityName);
          } else {
            this.progressBar.error(entityName, result.error || 'Unknown error');
          }
        }
        
        if (!result.success) {
          logger.error(`Sync failed for ${entityName}: ${result.error}`);
        }
        
        // Restore original method
        service.executeBatchInsert = originalExecuteBatch;
        
      } catch (error) {
        logger.error(`Unexpected error syncing ${entityName}:`, error);
        
        if (this.progressBar) {
          this.progressBar.error(entityName, error instanceof Error ? error.message : 'Unknown error');
        }
        
        results.push({
          entity: entityName,
          recordsSynced: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        });
      }
    }
    
    // Final summary
    console.log('\n\n=== Sync Results ===');
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordsSynced, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    results.forEach(result => {
      const status = result.success ? '✓' : '✗';
      const statusColor = result.success ? '\x1b[32m' : '\x1b[31m'; // Green or Red
      console.log(`${statusColor}${status}\x1b[0m ${result.entity}: ${result.recordsSynced.toLocaleString()} records in ${(result.duration / 1000).toFixed(2)}s`);
      if (!result.success && result.error) {
        console.log(`  Error: ${result.error}`);
      }
    });
    
    console.log('\n=== Summary ===');
    console.log(`Total entities: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total records: ${totalRecords.toLocaleString()}`);
    console.log(`Total duration: ${(totalDuration / 1000).toFixed(2)}s`);
    
    logger.info(`Sync completed: ${successful} successful, ${failed} failed, ${totalRecords} total records, ${totalDuration}ms total duration`);
    
    return results;
  }


  async getSyncStatus(): Promise<any[]> {
    const pool = await getConnection();
    const [rows] = await pool.execute(
      `SELECT 
        entity_name,
        sync_status,
        last_sync_at,
        records_synced,
        error_message,
        updated_at
       FROM sync_metadata
       ORDER BY 
         CASE 
           WHEN entity_name LIKE 'dados_%' THEN 0 
           ELSE 1 
         END,
         entity_name`
    );
    
    return rows as any[];
  }

  async getRecentSyncHistory(limit: number = 50): Promise<any[]> {
    const pool = await getConnection();
    const [rows] = await pool.execute(
      `SELECT 
        entity_name,
        operation,
        record_count,
        status,
        error_message,
        started_at,
        completed_at,
        CASE 
          WHEN completed_at IS NOT NULL 
          THEN TIMESTAMPDIFF(SECOND, started_at, completed_at) 
          ELSE NULL 
        END as duration_seconds
       FROM sync_audit_log
       ORDER BY started_at DESC
       LIMIT ${limit}`
    );
    
    return rows as any[];
  }

  async syncEntity(entityName: string, progressCallback?: (current: number, total: number) => void): Promise<SyncResult> {
    const service = this.syncServices.get(entityName.toLowerCase().replace('bi_', ''));
    
    if (!service) {
      throw new Error(`No sync service registered for entity: ${entityName}`);
    }
    
    // Track progress if callback provided
    if (progressCallback) {
      const originalExecuteBatch = service.executeBatchInsert;
      let recordsProcessed = 0;
      
      service.executeBatchInsert = async (...args: any[]) => {
        const result = await originalExecuteBatch.apply(service, args);
        recordsProcessed += result;
        
        // Estimate total based on the entity
        const estimates = await this.estimateTotalRecords();
        const estimatedTotal = estimates.get(entityName.toLowerCase().replace('bi_', '')) || 1000;
        
        progressCallback(recordsProcessed, Math.max(recordsProcessed, estimatedTotal));
        
        return result;
      };
      
      try {
        // Special handling for OS sync which needs options
        let result: SyncResult;
        if (entityName === 'os' && service instanceof IncrementalOsSyncService) {
          result = await service.sync({ 
            mode: 'incremental', 
            fetchDetails: true,
            showProgress: false
          });
        } else {
          result = await service.sync();
        }
        
        // Final callback with actual total
        if (result.success) {
          progressCallback(result.recordsSynced, result.recordsSynced);
        }
        
        return result;
      } finally {
        // Restore original method
        service.executeBatchInsert = originalExecuteBatch;
      }
    }
    
    // No progress tracking
    if (entityName === 'os' && service instanceof IncrementalOsSyncService) {
      return await service.sync({ 
        mode: 'incremental', 
        fetchDetails: true,
        showProgress: false
      });
    }
    
    return await service.sync();
  }

  async stopSync(): Promise<void> {
    logger.info('Sync stop requested');
    // TODO: Implement actual sync stopping logic
  }
}