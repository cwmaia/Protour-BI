import { getConnection, closeConnection } from '../config/database';
import logger from '../utils/logger';

async function resetSyncStatus(): Promise<void> {
  try {
    const pool = await getConnection();
    
    // Reset all sync metadata to pending
    await pool.execute(
      `UPDATE sync_metadata 
       SET sync_status = 'pending', 
           error_message = NULL
       WHERE sync_status IN ('running', 'failed')`
    );
    
    logger.info('Reset sync status for stuck/failed syncs');
    console.log('Sync status reset successfully');
    
  } catch (error) {
    logger.error('Failed to reset sync status:', error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  resetSyncStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export default resetSyncStatus;