import { getConnection, closeConnection } from '../config/database';
import logger from '../utils/logger';

// Interface removed as it was unused

async function cleanupSyncMetadata(): Promise<void> {
  const pool = await getConnection();
  const connection = await pool.getConnection();
  
  try {
    logger.info('Starting sync metadata cleanup...');
    console.log('\n🧹 Starting sync metadata cleanup...\n');
    
    // Start transaction
    await connection.beginTransaction();
    
    // 1. Find duplicate entries
    const [duplicates] = await connection.execute<any[]>(
      `SELECT entity_name, COUNT(*) as count, MIN(id) as keep_id
       FROM sync_metadata
       GROUP BY entity_name
       HAVING COUNT(*) > 1`
    );
    
    if (duplicates.length > 0) {
      console.log(`📊 Found ${duplicates.length} entities with duplicate entries:`);
      
      for (const dup of duplicates) {
        console.log(`   - ${dup.entity_name}: ${dup.count} entries (keeping ID: ${dup.keep_id})`);
        
        // Delete duplicate entries, keeping only the oldest one
        await connection.execute(
          `DELETE FROM sync_metadata 
           WHERE entity_name = ? AND id != ?`,
          [dup.entity_name, dup.keep_id]
        );
      }
      
      console.log('\n✅ Removed duplicate entries');
    } else {
      console.log('✅ No duplicate entries found');
    }
    
    // 2. Reset all entity statuses to 'pending'
    const [resetResult] = await connection.execute<any>(
      `UPDATE sync_metadata 
       SET sync_status = 'pending', 
           last_sync_at = NULL,
           records_synced = 0,
           error_message = NULL,
           updated_at = CURRENT_TIMESTAMP`
    );
    
    console.log(`\n🔄 Reset ${resetResult.affectedRows} entities to 'pending' status`);
    
    // 3. Clear sync_audit_log table
    const [clearResult] = await connection.execute<any>(
      `DELETE FROM sync_audit_log`
    );
    
    console.log(`\n🗑️  Cleared ${clearResult.affectedRows} records from sync_audit_log`);
    
    // 4. Display final state
    const [entities] = await connection.execute<any[]>(
      `SELECT entity_name, sync_status, created_at 
       FROM sync_metadata 
       ORDER BY entity_name`
    );
    
    console.log('\n📋 Final sync_metadata state:');
    console.log('─'.repeat(60));
    console.log('Entity Name'.padEnd(30) + 'Status'.padEnd(15) + 'Created At');
    console.log('─'.repeat(60));
    
    for (const entity of entities) {
      const createdAt = new Date(entity.created_at).toLocaleString();
      console.log(
        entity.entity_name.padEnd(30) + 
        entity.sync_status.padEnd(15) + 
        createdAt
      );
    }
    
    // Commit transaction
    await connection.commit();
    
    logger.info('Sync metadata cleanup completed successfully');
    console.log('\n✨ Cleanup completed successfully!');
    
  } catch (error) {
    // Rollback on error
    await connection.rollback();
    logger.error('Failed to cleanup sync metadata:', error);
    console.error('\n❌ Cleanup failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the cleanup if executed directly
if (require.main === module) {
  cleanupSyncMetadata()
    .then(async () => {
      await closeConnection();
      console.log('\n👋 Goodbye!');
      process.exit(0);
    })
    .catch(async (error) => {
      await closeConnection();
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export default cleanupSyncMetadata;