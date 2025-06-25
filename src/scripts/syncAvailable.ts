import { SyncOrchestrator } from '../services/sync.orchestrator';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';

async function syncAvailable(): Promise<void> {
  const orchestrator = new SyncOrchestrator();
  
  // Only sync entities that have working endpoints
  const availableEntities = [
    'clientes',
    'veiculos', 
    'condutores',
    'contratomaster',
    'reservas'
  ];
  
  try {
    console.log(chalk.bold.cyan('\n=== Syncing Available Entities ===\n'));
    console.log(chalk.gray('Entities to sync: ' + availableEntities.join(', ')));
    console.log(chalk.gray('Running sequentially to avoid rate limiting...\n'));
    
    const results = [];
    
    for (const entity of availableEntities) {
      console.log(chalk.blue(`\n▶ Starting sync for ${entity}...`));
      
      try {
        const result = await orchestrator.syncEntity(entity, false); // No progress bar for cleaner output
        
        if (result.success) {
          console.log(chalk.green(`✓ ${entity}: ${result.recordsSynced} records synced in ${(result.duration / 1000).toFixed(2)}s`));
        } else {
          console.log(chalk.red(`✗ ${entity}: Failed - ${result.error}`));
        }
        
        results.push(result);
        
        // Wait 2 seconds between syncs to avoid rate limiting
        if (availableEntities.indexOf(entity) < availableEntities.length - 1) {
          console.log(chalk.gray('  Waiting 2s to avoid rate limiting...'));
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.log(chalk.red(`✗ ${entity}: Error - ${error instanceof Error ? error.message : 'Unknown error'}`));
        results.push({
          entity,
          recordsSynced: 0,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: 0
        });
      }
    }
    
    // Summary
    console.log(chalk.bold.cyan('\n\n=== Sync Summary ===\n'));
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const totalRecords = results.reduce((sum, r) => sum + r.recordsSynced, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(chalk.green(`✓ Successful: ${successful}`));
    console.log(chalk.red(`✗ Failed: ${failed}`));
    console.log(chalk.cyan(`📊 Total Records: ${totalRecords.toLocaleString()}`));
    console.log(chalk.gray(`⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`));
    
  } catch (error) {
    logger.error('Sync failed:', error);
    console.error(chalk.red('\nSync failed:'), error);
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (require.main === module) {
  syncAvailable()
    .then(() => {
      logger.info('Sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Sync failed:', error);
      process.exit(1);
    });
}

export default syncAvailable;