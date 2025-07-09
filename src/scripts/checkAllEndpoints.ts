import { getConnection } from '../config/database';
import { apiEndpoints } from '../config/endpoints';

async function checkAllEndpoints() {
  const pool = await getConnection();
  
  console.log('=== API ENDPOINTS IN CONFIGURATION ===');
  console.log('Total endpoints configured:', Object.keys(apiEndpoints).length);
  console.log('\nEndpoint mapping:');
  Object.entries(apiEndpoints).forEach(([entity, endpoint]) => {
    console.log(`  ${entity} -> ${endpoint}`);
  });
  
  console.log('\n=== SYNC METADATA STATUS ===');
  const [metadata] = await pool.execute(`
    SELECT 
      entity_name,
      sync_status,
      last_sync_at,
      records_synced,
      error_message,
      DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') as updated_at
    FROM sync_metadata
    ORDER BY entity_name
  `) as any;
  
  console.table(metadata);
  
  console.log('\n=== RECORD COUNTS BY TABLE ===');
  const tables = [
    { name: 'bi_dados_veiculos', entity: 'dados_veiculos' },
    { name: 'bi_dados_clientes', entity: 'dados_clientes' },
    { name: 'bi_vehicle_expenses', entity: null },
    { name: 'clientes', entity: 'clientes' },
    { name: 'condutores', entity: 'condutores' },
    { name: 'veiculos', entity: 'veiculos' },
    { name: 'contratos', entity: 'contratos' },
    { name: 'contrato_master', entity: 'contratomaster' },
    { name: 'reservas', entity: 'reservas' },
    { name: 'formas_pagamento', entity: 'formas_pagamento' },
    { name: 'os', entity: 'os' },
    { name: 'os_itens', entity: null }
  ];
  
  const tableCounts: any[] = [];
  
  for (const table of tables) {
    try {
      const [count] = await pool.execute(`SELECT COUNT(*) as count FROM ${table.name}`) as any;
      const syncInfo = metadata.find((m: any) => m.entity_name === table.entity);
      
      tableCounts.push({
        table: table.name,
        entity: table.entity || 'N/A',
        count: count[0].count,
        sync_status: syncInfo?.sync_status || 'N/A',
        last_sync: syncInfo?.last_sync_at || 'N/A'
      });
    } catch (error) {
      tableCounts.push({
        table: table.name,
        entity: table.entity || 'N/A',
        count: 'ERROR',
        sync_status: 'N/A',
        last_sync: 'N/A'
      });
    }
  }
  
  console.table(tableCounts);
  
  console.log('\n=== ENDPOINT SYNC ANALYSIS ===');
  
  // Check which endpoints are synced
  const endpointStatus: any[] = [];
  
  for (const [entity, endpoint] of Object.entries(apiEndpoints)) {
    const syncInfo = metadata.find((m: any) => m.entity_name === entity);
    const tableInfo = tableCounts.find(t => t.entity === entity);
    
    endpointStatus.push({
      entity,
      endpoint,
      sync_status: syncInfo?.sync_status || 'NOT_SYNCED',
      records_synced: syncInfo?.records_synced || 0,
      records_in_db: tableInfo?.count || 0,
      last_sync: syncInfo?.last_sync_at || 'NEVER',
      has_error: syncInfo?.error_message ? 'YES' : 'NO'
    });
  }
  
  console.table(endpointStatus);
  
  // Summary
  console.log('\n=== SUMMARY ===');
  const syncedEndpoints = endpointStatus.filter(e => e.sync_status === 'completed' || e.sync_status === 'success');
  const failedEndpoints = endpointStatus.filter(e => e.sync_status === 'error' || e.has_error === 'YES');
  const notSyncedEndpoints = endpointStatus.filter(e => e.sync_status === 'NOT_SYNCED');
  
  console.log(`Total endpoints: ${endpointStatus.length}`);
  console.log(`Successfully synced: ${syncedEndpoints.length}`);
  console.log(`Failed: ${failedEndpoints.length}`);
  console.log(`Not synced: ${notSyncedEndpoints.length}`);
  
  if (failedEndpoints.length > 0) {
    console.log('\nFailed endpoints:');
    failedEndpoints.forEach(e => {
      const errorInfo = metadata.find((m: any) => m.entity_name === e.entity);
      console.log(`  - ${e.entity} (${e.endpoint}): ${errorInfo?.error_message || 'Unknown error'}`);
    });
  }
  
  if (notSyncedEndpoints.length > 0) {
    console.log('\nNot synced endpoints:');
    notSyncedEndpoints.forEach(e => {
      console.log(`  - ${e.entity} (${e.endpoint})`);
    });
  }
  
  // Check for BI-specific endpoints we might have missed
  console.log('\n=== POTENTIAL MISSING BI ENDPOINTS ===');
  console.log('Known BI endpoints in our config:');
  console.log('  - /dadosVeiculos (dados_veiculos)');
  console.log('  - /dadosClientes (dados_clientes)');
  console.log('\nPotential BI endpoints to investigate:');
  console.log('  - /dadosCondutores (driver BI data)');
  console.log('  - /dadosContratos (contract BI data)');
  console.log('  - /dadosReservas (reservation BI data)');
  console.log('  - /dadosFinanceiro (financial BI data)');
  console.log('  - /dadosManutencao (maintenance BI data)');
  console.log('  - /dadosOS (service order BI data)');
  
  await pool.end();
}

checkAllEndpoints().catch(console.error);