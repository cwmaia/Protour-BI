import { FormasPagamentoSyncService } from '../services/sync/formasPagamento.sync';
import { ContratosSyncService } from '../services/sync/contratos.sync';
import { getConnection } from '../config/database';

async function testFixedEndpoints() {
  console.log('Testing fixed endpoints...\n');

  try {
    // Test FormaPagamento sync
    console.log('Testing FormaPagamento sync...');
    const formasPagamentoSync = new FormasPagamentoSyncService();
    const formasPagamentoResult = await formasPagamentoSync.sync();
    console.log('FormaPagamento sync result:', formasPagamentoResult);
    console.log('---');

    // Test Contrato sync
    console.log('Testing Contrato sync...');
    const contratosSync = new ContratosSyncService();
    const contratosResult = await contratosSync.sync();
    console.log('Contrato sync result:', contratosResult);
    console.log('---');

    // Check database for synced records
    const pool = await getConnection();
    
    const [formasPagamentoCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM formas_pagamento'
    );
    console.log('FormaPagamento records in database:', (formasPagamentoCount as any)[0].count);

    const [contratosCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM contratos'
    );
    console.log('Contratos records in database:', (contratosCount as any)[0].count);

    await pool.end();
  } catch (error) {
    console.error('Error testing endpoints:', error);
  }
  
  process.exit(0);
}

testFixedEndpoints().catch(console.error);