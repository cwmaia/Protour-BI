import { SyncOrchestrator } from '../services/sync.orchestrator';
import { getConnection } from '../config/database';

async function testAllSyncs() {
  console.log('Testing all sync services...\n');
  
  const orchestrator = new SyncOrchestrator();
  
  try {
    // Get current sync status before running
    console.log('=== Current Sync Status ===');
    const statusBefore = await orchestrator.getSyncStatus();
    statusBefore.forEach(row => {
      console.log(`${row.entity_name}: ${row.sync_status} - ${row.records_synced || 0} records - Last sync: ${row.last_sync_at || 'Never'}`);
    });
    console.log('\n');
    
    // Run sync for all entities
    console.log('=== Running Full Sync ===\n');
    const results = await orchestrator.syncAll(true);
    
    console.log('\n=== Database Record Counts ===');
    const pool = await getConnection();
    
    const tables = [
      'dados_veiculos',
      'dados_clientes',
      'formas_pagamento',
      'clientes',
      'veiculos',
      'condutores',
      'contratos',
      'contrato_master',
      'reservas'
    ];
    
    for (const table of tables) {
      try {
        const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`${table}: ${(rows as any)[0].count} records`);
      } catch (error: any) {
        console.log(`${table}: Error - ${error.message}`);
      }
    }
    
    // Get updated sync status
    console.log('\n=== Updated Sync Status ===');
    const statusAfter = await orchestrator.getSyncStatus();
    statusAfter.forEach(row => {
      const icon = row.sync_status === 'completed' ? '✓' : row.sync_status === 'failed' ? '✗' : '⚠';
      console.log(`${icon} ${row.entity_name}: ${row.sync_status} - ${row.records_synced || 0} records`);
      if (row.error_message) {
        console.log(`  Error: ${row.error_message}`);
      }
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error during sync test:', error);
  }
  
  process.exit(0);
}

testAllSyncs().catch(console.error);