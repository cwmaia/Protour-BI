import { getConnection } from '../config/database';
import logger from '../utils/logger';

async function checkOsData() {
  try {
    const pool = await getConnection();
    
    // Check OS table
    const [osRows] = await pool.execute('SELECT COUNT(*) as count FROM os');
    const osCount = (osRows as any)[0].count;
    console.log(`\n=== OS DATA STATUS ===`);
    console.log(`OS records: ${osCount}`);
    
    // Check OS items table
    const [itemRows] = await pool.execute('SELECT COUNT(*) as count FROM os_itens');
    const itemCount = (itemRows as any)[0].count;
    console.log(`OS items: ${itemCount}`);
    
    // Check bi_vehicle_expenses table
    const [expenseRows] = await pool.execute('SELECT COUNT(*) as count FROM bi_vehicle_expenses');
    const expenseCount = (expenseRows as any)[0].count;
    console.log(`Vehicle expenses: ${expenseCount}`);
    
    // Sample some OS records to see if they have items
    console.log('\n=== SAMPLE OS RECORDS ===');
    const [sampleOs] = await pool.execute(`
      SELECT 
        o.codigo_os, 
        o.placa, 
        o.data_abertura,
        o.valor_total,
        o.quantidade_itens,
        COUNT(oi.id) as actual_items
      FROM os o
      LEFT JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      GROUP BY o.codigo_os
      LIMIT 10
    `);
    
    console.log('\nOS ID | Placa    | Date       | Total Value | Expected Items | Actual Items');
    console.log('------|----------|------------|-------------|----------------|-------------');
    (sampleOs as any[]).forEach(row => {
      console.log(
        `${String(row.codigo_os).padEnd(5)} | ` +
        `${String(row.placa || 'N/A').padEnd(8)} | ` +
        `${new Date(row.data_abertura).toISOString().split('T')[0]} | ` +
        `${String(row.valor_total).padStart(11)} | ` +
        `${String(row.quantidade_itens).padStart(14)} | ` +
        `${String(row.actual_items).padStart(12)}`
      );
    });
    
    // Check if any vehicles have expenses
    console.log('\n=== VEHICLES WITH EXPENSES ===');
    const [vehicleExpenses] = await pool.execute(`
      SELECT 
        v.placa,
        COUNT(DISTINCT o.codigo_os) as os_count,
        SUM(oi.valor_total_item) as total_expenses
      FROM veiculos v
      INNER JOIN os o ON v.placa = o.placa
      LEFT JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      GROUP BY v.placa
      HAVING os_count > 0
      LIMIT 10
    `);
    
    if ((vehicleExpenses as any[]).length === 0) {
      console.log('No vehicles found with OS records');
    } else {
      console.log('\nPlaca    | OS Count | Total Expenses');
      console.log('---------|----------|---------------');
      (vehicleExpenses as any[]).forEach(row => {
        console.log(
          `${String(row.placa).padEnd(8)} | ` +
          `${String(row.os_count).padStart(8)} | ` +
          `${row.total_expenses ? row.total_expenses.toFixed(2).padStart(14) : 'NULL'.padStart(14)}`
        );
      });
    }
    
    // Check why bi_vehicle_expenses might be empty
    console.log('\n=== DIAGNOSTIC: Why is bi_vehicle_expenses empty? ===');
    
    // 1. Check if there are any OS records with items
    const [osWithItems] = await pool.execute(`
      SELECT COUNT(DISTINCT o.codigo_os) as count
      FROM os o
      INNER JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      WHERE o.placa IS NOT NULL
    `);
    console.log(`OS records with items and placa: ${(osWithItems as any)[0].count}`);
    
    // 2. Check if any OS placas match vehicle placas
    const [matchingPlacas] = await pool.execute(`
      SELECT COUNT(DISTINCT o.placa) as count
      FROM os o
      INNER JOIN veiculos v ON o.placa = v.placa
      WHERE o.placa IS NOT NULL
    `);
    console.log(`OS placas matching vehicles in veiculos table: ${(matchingPlacas as any)[0].count}`);
    
    // Also check bi_dados_veiculos
    const [matchingBiPlacas] = await pool.execute(`
      SELECT COUNT(DISTINCT o.placa) as count
      FROM os o
      INNER JOIN bi_dados_veiculos v ON o.placa = v.placa
      WHERE o.placa IS NOT NULL
    `);
    console.log(`OS placas matching vehicles in bi_dados_veiculos: ${(matchingBiPlacas as any)[0].count}`);
    
    await pool.end();
    
  } catch (error) {
    logger.error('Error checking OS data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  checkOsData();
}