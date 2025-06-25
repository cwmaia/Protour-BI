import { SyncOrchestrator } from '../services/sync.orchestrator';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';

async function syncEntity(): Promise<void> {
  const orchestrator = new SyncOrchestrator();
  
  try {
    // Get entity name from command line arguments
    const entityName = process.argv[2];
    
    if (!entityName) {
      console.log(chalk.red('Error: Please specify an entity to sync'));
      console.log(chalk.gray('\nUsage: npm run sync:entity <entity_name>'));
      console.log(chalk.gray('\nAvailable entities:'));
      console.log(chalk.gray('  - dados_veiculos (BI vehicle data)'));
      console.log(chalk.gray('  - dados_clientes (BI client data)'));
      console.log(chalk.gray('  - formas_pagamento (payment methods)'));
      console.log(chalk.gray('  - clientes (clients)'));
      console.log(chalk.gray('  - veiculos (vehicles)'));
      console.log(chalk.gray('  - condutores (drivers)'));
      console.log(chalk.gray('  - contratos (contracts)'));
      console.log(chalk.gray('  - contratomaster (master contracts)'));
      console.log(chalk.gray('  - reservas (reservations)'));
      process.exit(1);
    }
    
    logger.info(`Starting sync for entity: ${entityName}`);
    console.log(chalk.bold.cyan(`\n=== Syncing ${entityName} ===\n`));
    
    const showProgress = !process.argv.includes('--no-progress');
    const result = await orchestrator.syncEntity(entityName, showProgress);
    
    // Display result
    console.log('\n' + chalk.bold('=== Sync Result ==='));
    
    if (result.success) {
      console.log(chalk.green(`✓ Success: ${result.recordsSynced.toLocaleString()} records synced in ${(result.duration / 1000).toFixed(2)}s`));
    } else {
      console.log(chalk.red(`✗ Failed: ${result.error}`));
      console.log(chalk.yellow(`  Records processed: ${result.recordsSynced}`));
    }
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('No sync service registered')) {
      console.error(chalk.red('Error: Invalid entity name'));
      console.log(chalk.gray('\nUse one of the available entities listed above.'));
    } else {
      logger.error('Sync failed:', error);
      console.error(chalk.red('Sync failed:'), error);
    }
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (require.main === module) {
  syncEntity()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Sync failed:', error);
      process.exit(1);
    });
}

export default syncEntity;