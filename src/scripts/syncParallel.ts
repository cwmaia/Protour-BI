import { SyncOrchestrator } from '../services/sync.orchestrator';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';
import { MultiProgressBar } from '../utils/progressBar';
import chalk from 'chalk';

async function syncParallel(): Promise<void> {
  const orchestrator = new SyncOrchestrator();
  const progressBar = new MultiProgressBar();
  
  try {
    logger.info('Starting parallel sync of remaining entities...');
    
    // Get sync status to identify what needs to be synced
    const status = await orchestrator.getSyncStatus();
    const pendingEntities = status
      .filter(s => s.sync_status === 'pending' && s.entity_name !== 'dados_veiculos' && s.entity_name !== 'dados_clientes')
      .map(s => s.entity_name);
    
    if (pendingEntities.length === 0) {
      console.log(chalk.yellow('No pending entities to sync.'));
      return;
    }
    
    console.log(chalk.bold.cyan(`\n=== Starting Parallel Sync for ${pendingEntities.length} Entities ===\n`));
    console.log(chalk.gray('Entities to sync: ' + pendingEntities.join(', ')));
    console.log('');
    
    // Estimate records for each entity
    const estimates = await orchestrator.estimateTotalRecords();
    
    // Initialize progress bars
    pendingEntities.forEach(entity => {
      progressBar.addBar(entity, estimates.get(entity) || 100);
    });
    
    // Create sync promises with progress tracking - with staggered starts
    const syncPromises = pendingEntities.map(async (entityName, index) => {
      // Stagger the start of each sync to avoid overwhelming the API
      const startDelay = index * 1000; // 1 second delay between each entity start
      await new Promise(resolve => setTimeout(resolve, startDelay));
      
      const service = (orchestrator as any).syncServices.get(entityName);
      if (!service) {
        progressBar.error(entityName, 'Service not found');
        return null;
      }
      
      // Track progress
      const originalExecuteBatch = service.executeBatchInsert;
      let recordsProcessed = 0;
      
      service.executeBatchInsert = async (...args: any[]) => {
        try {
          const result = await originalExecuteBatch.apply(service, args);
          recordsProcessed += result;
          progressBar.update(entityName, recordsProcessed, 'running');
          return result;
        } catch (error) {
          progressBar.error(entityName, error instanceof Error ? error.message : 'Unknown error');
          throw error;
        }
      };
      
      progressBar.update(entityName, 0, 'running');
      
      try {
        const result = await service.sync();
        
        if (result.success) {
          progressBar.complete(entityName);
        } else {
          progressBar.error(entityName, result.error || 'Unknown error');
        }
        
        // Restore original method
        service.executeBatchInsert = originalExecuteBatch;
        
        return result;
      } catch (error) {
        progressBar.error(entityName, error instanceof Error ? error.message : 'Unknown error');
        service.executeBatchInsert = originalExecuteBatch;
        
        return {
          entity: entityName,
          recordsSynced: recordsProcessed,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        };
      }
    });
    
    // Run all syncs in parallel
    const results = await Promise.all(syncPromises);
    
    // Final summary
    console.log('\n\n' + chalk.bold.cyan('=== Parallel Sync Results ===\n'));
    
    const validResults = results.filter(r => r !== null);
    const successful = validResults.filter(r => r && r.success).length;
    const failed = validResults.filter(r => r && !r.success).length;
    const totalRecords = validResults.reduce((sum, r) => sum + (r ? r.recordsSynced : 0), 0);
    const totalDuration = validResults.reduce((sum, r) => sum + (r ? r.duration : 0), 0);
    
    validResults.forEach(result => {
      if (!result) return;
      
      const status = result.success ? chalk.green('✓') : chalk.red('✗');
      const duration = (result.duration / 1000).toFixed(2);
      
      console.log(`${status} ${result.entity.padEnd(20)} ${result.recordsSynced.toString().padStart(6)} records in ${duration.padStart(6)}s`);
      
      if (!result.success && result.error) {
        console.log(chalk.red(`  └─ Error: ${result.error}`));
      }
    });
    
    console.log(chalk.gray('\n' + '─'.repeat(60)));
    console.log(chalk.bold('Summary:'));
    console.log(chalk.green(`  ✓ Successful: ${successful}`));
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
    console.log(chalk.cyan(`  📊 Total Records: ${totalRecords.toLocaleString()}`));
    console.log(chalk.gray(`  ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`));
    console.log(chalk.blue(`  🚀 Parallel Speedup: ${validResults.length}x`));
    
  } catch (error) {
    logger.error('Parallel sync failed:', error);
    console.error(chalk.red('\nParallel sync failed:'), error);
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (require.main === module) {
  syncParallel()
    .then(() => {
      logger.info('Parallel sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Parallel sync failed:', error);
      process.exit(1);
    });
}

export default syncParallel;