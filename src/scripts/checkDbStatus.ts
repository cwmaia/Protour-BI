import { getConnection, closeConnection } from '../config/database';
import logger from '../utils/logger';

async function checkDbStatus(): Promise<void> {
  try {
    const pool = await getConnection();
    
    // Check vehicle records
    const [vehicleRows] = await pool.execute('SELECT COUNT(*) as count FROM bi_dados_veiculos');
    const vehicleCount = (vehicleRows as any)[0].count;
    
    // Check client records  
    const [clientRows] = await pool.execute('SELECT COUNT(*) as count FROM bi_dados_clientes');
    const clientCount = (clientRows as any)[0].count;
    
    // Check sync metadata
    const [syncRows] = await pool.execute('SELECT * FROM sync_metadata');
    
    console.log('\n=== Database Status ===');
    console.log(`Vehicle Records: ${vehicleCount}`);
    console.log(`Client Records: ${clientCount}`);
    console.log('\n=== Sync Status ===');
    
    (syncRows as any[]).forEach(row => {
      console.log(`${row.entity_name}:`);
      console.log(`  Status: ${row.sync_status}`);
      console.log(`  Last Sync: ${row.last_sync_at || 'Never'}`);
      console.log(`  Records: ${row.records_synced}`);
      if (row.error_message) {
        console.log(`  Error: ${row.error_message}`);
      }
    });
    
  } catch (error) {
    logger.error('Database status check failed:', error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  checkDbStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export default checkDbStatus;