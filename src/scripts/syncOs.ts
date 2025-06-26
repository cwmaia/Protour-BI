import { OsSyncService } from '../services/sync/os.sync';
import { getConnection } from '../config/database';
import logger from '../utils/logger';

async function syncOs() {
  try {
    logger.info('Starting OS (Service Orders) sync...');
    
    // Initialize database connection
    await getConnection();
    
    // Create and run OS sync service
    const osSyncService = new OsSyncService();
    const result = await osSyncService.sync();
    
    if (result.success) {
      logger.info(`OS sync completed successfully!`);
      logger.info(`Records synced: ${result.recordsSynced}`);
      logger.info(`Duration: ${(result.duration / 1000).toFixed(2)} seconds`);
    } else {
      logger.error(`OS sync failed: ${result.error}`);
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Unexpected error during OS sync:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  syncOs();
}