import { getConnection } from '../config/database';
import logger from '../utils/logger';

async function checkVehicleExpenses() {
  try {
    const pool = await getConnection();
    
    console.log('\n=== VEHICLE EXPENSE ANALYSIS ===\n');
    
    // Check bi_vehicle_expenses status
    const [expenseStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_vehicles,
        SUM(CASE WHEN total_expenses > 0 THEN 1 ELSE 0 END) as vehicles_with_expenses,
        SUM(total_expenses) as grand_total,
        AVG(total_expenses) as avg_expense_per_vehicle,
        MAX(total_expenses) as max_expense,
        SUM(total_items) as total_items
      FROM bi_vehicle_expenses
    `);
    
    const stats = (expenseStats as any[])[0];
    console.log('BI Vehicle Expenses Summary:');
    console.log(`- Total vehicles with OS: ${stats.total_vehicles}`);
    console.log(`- Vehicles with expenses > 0: ${stats.vehicles_with_expenses}`);
    console.log(`- Grand total expenses: R$ ${parseFloat(stats.grand_total || 0).toFixed(2)}`);
    console.log(`- Average per vehicle: R$ ${parseFloat(stats.avg_expense_per_vehicle || 0).toFixed(2)}`);
    console.log(`- Maximum expense: R$ ${parseFloat(stats.max_expense || 0).toFixed(2)}`);
    console.log(`- Total items: ${stats.total_items || 0}`);
    
    // Top 10 vehicles by expense
    console.log('\n=== TOP 10 VEHICLES BY EXPENSE ===');
    const [topVehicles] = await pool.execute(`
      SELECT 
        ve.placa,
        ve.total_expenses,
        ve.expense_count,
        ve.total_items,
        ve.first_expense_date,
        ve.last_expense_date,
        DATEDIFF(ve.last_expense_date, ve.first_expense_date) as days_span,
        v.modelo,
        v.ano_modelo
      FROM bi_vehicle_expenses ve
      LEFT JOIN bi_dados_veiculos v ON ve.placa = v.placa
      WHERE ve.total_expenses > 0
      ORDER BY ve.total_expenses DESC
      LIMIT 10
    `);
    
    console.log('\nRank | Placa    | Model/Year                    | OS Count | Items | Total (R$)  | Period');
    console.log('-----|----------|-------------------------------|----------|-------|-------------|--------');
    (topVehicles as any[]).forEach((row, idx) => {
      const model = row.modelo ? `${row.modelo} ${row.ano_modelo || ''}`.substring(0, 28) : 'N/A';
      const period = row.days_span ? `${row.days_span} days` : 'Same day';
      console.log(
        `${String(idx + 1).padStart(4)} | ` +
        `${String(row.placa).padEnd(8)} | ` +
        `${model.padEnd(29)} | ` +
        `${String(row.expense_count).padStart(8)} | ` +
        `${String(row.total_items).padStart(5)} | ` +
        `${parseFloat(row.total_expenses).toFixed(2).padStart(11)} | ` +
        `${period}`
      );
    });
    
    // Vehicles with zero-value items
    console.log('\n=== VEHICLES WITH ZERO-VALUE EXPENSES ===');
    const [zeroValueVehicles] = await pool.execute(`
      SELECT 
        o.placa,
        COUNT(DISTINCT o.codigo_os) as os_count,
        COUNT(oi.id) as item_count,
        SUM(CASE WHEN oi.valor_item = 0 THEN 1 ELSE 0 END) as zero_value_items
      FROM os o
      INNER JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      WHERE o.placa IS NOT NULL
      GROUP BY o.placa
      HAVING zero_value_items > 0
      ORDER BY zero_value_items DESC
      LIMIT 10
    `);
    
    if ((zeroValueVehicles as any[]).length > 0) {
      console.log('\nPlaca    | OS Count | Total Items | Zero-Value Items');
      console.log('---------|----------|-------------|------------------');
      (zeroValueVehicles as any[]).forEach(row => {
        console.log(
          `${String(row.placa).padEnd(8)} | ` +
          `${String(row.os_count).padStart(8)} | ` +
          `${String(row.item_count).padStart(11)} | ` +
          `${String(row.zero_value_items).padStart(16)}`
        );
      });
    } else {
      console.log('No vehicles found with zero-value items');
    }
    
    // OS without items
    console.log('\n=== OS RECORDS WITHOUT ITEMS ===');
    const [osWithoutItems] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM os
      WHERE quantidade_itens = 0
    `);
    console.log(`OS records without items: ${(osWithoutItems as any[])[0].count}`);
    
    // Sample OS with items
    console.log('\n=== SAMPLE OS WITH ITEMS ===');
    const [sampleOs] = await pool.execute(`
      SELECT 
        o.codigo_os,
        o.placa,
        o.data_abertura,
        o.valor_total,
        o.quantidade_itens,
        GROUP_CONCAT(
          CONCAT('Item ', oi.numero_item, ': R$ ', oi.valor_item, ' x ', oi.quantidade)
          SEPARATOR ' | '
        ) as items_detail
      FROM os o
      INNER JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      WHERE o.valor_total > 0
      GROUP BY o.codigo_os
      ORDER BY o.valor_total DESC
      LIMIT 5
    `);
    
    console.log('\nOS ID | Placa    | Date       | Total (R$) | Items');
    console.log('------|----------|------------|------------|-------');
    (sampleOs as any[]).forEach(row => {
      console.log(
        `${String(row.codigo_os).padEnd(5)} | ` +
        `${String(row.placa || 'N/A').padEnd(8)} | ` +
        `${new Date(row.data_abertura).toISOString().split('T')[0]} | ` +
        `${parseFloat(row.valor_total).toFixed(2).padStart(10)} | ` +
        `${row.quantidade_itens} items`
      );
      console.log(`      Items: ${row.items_detail}`);
      console.log();
    });
    
    await pool.end();
    
  } catch (error) {
    logger.error('Error checking vehicle expenses:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  checkVehicleExpenses();
}