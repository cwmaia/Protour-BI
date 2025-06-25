import { SyncOrchestrator } from '../services/sync.orchestrator';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';

interface BatchConfig {
  entities: string[];
  batchDelay: number; // Delay between batches in ms
}

async function syncBatched(): Promise<void> {
  const orchestrator = new SyncOrchestrator();
  
  try {
    logger.info('Starting batched sync with rate limiting...');
    
    // Get sync status to identify what needs to be synced
    const status = await orchestrator.getSyncStatus();
    
    // Define batches with priority order
    const batches: BatchConfig[] = [
      {
        entities: ['dados_veiculos', 'dados_clientes'],
        batchDelay: 2000 // 2 seconds between BI data syncs
      },
      {
        entities: ['formas_pagamento', 'clientes', 'veiculos'],
        batchDelay: 3000 // 3 seconds between these
      },
      {
        entities: ['condutores', 'contratos'],
        batchDelay: 3000
      },
      {
        entities: ['contratomaster', 'reservas'],
        batchDelay: 3000
      }
    ];
    
    console.log(chalk.bold.cyan('\n=== Starting Batched Sync with Rate Limiting ===\n'));
    
    const results: any[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(chalk.bold.yellow(`\nBatch ${i + 1}/${batches.length}: ${batch.entities.join(', ')}\n`));
      
      for (const entityName of batch.entities) {
        const entityStatus = status.find(s => s.entity_name === entityName);
        
        if (!entityStatus) {
          console.log(chalk.red(`✗ ${entityName} - Not found in sync metadata`));
          continue;
        }
        
        if (entityStatus.sync_status === 'completed') {
          console.log(chalk.gray(`⏭ ${entityName} - Already synced, skipping...`));
          continue;
        }
        
        console.log(chalk.cyan(`🔄 Syncing ${entityName}...`));
        
        try {
          const result = await orchestrator.syncEntity(entityName, true);
          results.push(result);
          
          if (result.success) {
            console.log(chalk.green(`✓ ${entityName} - ${result.recordsSynced} records synced in ${(result.duration / 1000).toFixed(2)}s`));
          } else {
            console.log(chalk.red(`✗ ${entityName} - Failed: ${result.error}`));
          }
          
          // Add delay between entities in the same batch
          if (batch.entities.indexOf(entityName) < batch.entities.length - 1) {
            console.log(chalk.gray(`⏱ Waiting ${batch.batchDelay / 1000}s before next entity...`));
            await new Promise(resolve => setTimeout(resolve, batch.batchDelay));
          }
          
        } catch (error) {
          console.log(chalk.red(`✗ ${entityName} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          results.push({
            entity: entityName,
            recordsSynced: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            duration: 0
          });
        }
      }
      
      // Add longer delay between batches
      if (i < batches.length - 1) {
        const batchDelay = 5000; // 5 seconds between batches
        console.log(chalk.gray(`\n⏱ Waiting ${batchDelay / 1000}s before next batch...\n`));
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
    
    // Final summary
    console.log('\n\n' + chalk.bold.cyan('=== Batched Sync Results ===\n'));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordsSynced, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    results.forEach(result => {
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
    
  } catch (error) {
    logger.error('Batched sync failed:', error);
    console.error(chalk.red('\nBatched sync failed:'), error);
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (require.main === module) {
  syncBatched()
    .then(() => {
      logger.info('Batched sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Batched sync failed:', error);
      process.exit(1);
    });
}

export default syncBatched;