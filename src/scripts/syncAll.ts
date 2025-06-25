import { SyncOrchestrator } from '../services/sync.orchestrator';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';

async function syncAll(): Promise<void> {
  const orchestrator = new SyncOrchestrator();
  
  try {
    logger.info('Starting manual sync of all entities...');
    
    // Show progress visualization by default
    const showProgress = !process.argv.includes('--no-progress');
    await orchestrator.syncAll(showProgress);
    
  } catch (error) {
    logger.error('Sync failed:', error);
    throw error;
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (require.main === module) {
  syncAll()
    .then(() => {
      logger.info('Sync completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Sync failed:', error);
      process.exit(1);
    });
}

export default syncAll;