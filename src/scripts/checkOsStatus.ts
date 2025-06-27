import { getConnection, closeConnection } from '../config/database';
import chalk from 'chalk';

async function checkOsStatus() {
  console.log(chalk.bold.cyan('\n=== OS Sync Status Check ===\n'));
  
  try {
    const pool = await getConnection();
    
    // Get current statistics
    const [stats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT o.codigo_os) as os_count,
        COUNT(DISTINCT oi.id) as item_count,
        COALESCE(SUM(oi.valor_total_item), 0) as total_expenses,
        MIN(o.data_abertura) as first_date,
        MAX(o.data_abertura) as last_date,
        COUNT(DISTINCT o.placa) as vehicle_count
      FROM os o
      LEFT JOIN os_itens oi ON o.codigo_os = oi.codigo_os
    `);
    
    const data = (stats as any)[0];
    
    console.log(chalk.yellow('Current Database Status:'));
    console.log(`  OS Records: ${chalk.bold(data.os_count)}`);
    console.log(`  Item Records: ${chalk.bold(data.item_count)}`);
    console.log(`  Vehicles with OS: ${chalk.bold(data.vehicle_count)}`);
    console.log(`  Date Range: ${data.first_date ? new Date(data.first_date).toLocaleDateString() : 'N/A'} to ${data.last_date ? new Date(data.last_date).toLocaleDateString() : 'N/A'}`);
    console.log(`  Total Expenses: ${chalk.bold('R$ ' + parseFloat(data.total_expenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}`);
    
    // Calculate monthly average
    if (data.first_date && data.last_date) {
      const firstDate = new Date(data.first_date);
      const lastDate = new Date(data.last_date);
      const monthsDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
      const monthlyAvg = parseFloat(data.total_expenses) / Math.max(1, monthsDiff);
      console.log(`  Monthly Average: ${chalk.bold('R$ ' + monthlyAvg.toLocaleString('pt-BR', { minimumFractionDigits: 2 }))}`);
    }
    
    // Expected vs actual
    const expectedMonthly = 200000;
    const percentage = (parseFloat(data.total_expenses) / expectedMonthly) * 100;
    
    console.log(chalk.cyan(`\nExpense Analysis:`));
    console.log(`  Expected Monthly: R$ ${expectedMonthly.toLocaleString('pt-BR')}`);
    console.log(`  Current Coverage: ${chalk.bold(percentage.toFixed(1) + '%')}`);
    
    if (percentage < 20) {
      console.log(chalk.red(`\n⚠️  Critical: Only ${percentage.toFixed(1)}% of expected expenses captured!`));
      console.log(chalk.yellow('\nRecommendations:'));
      console.log('1. The current OS sync has only captured 100 records');
      console.log('2. Based on expense expectations, there should be thousands more OS records');
      console.log('3. Use the optimized sync with proper strategy:');
      console.log(chalk.green('   npm run sync:os-optimized -- --strategy balanced'));
      console.log('4. If API is unstable, use detailed strategy:');
      console.log(chalk.green('   npm run sync:os-optimized -- --strategy detailed'));
    }
    
    // Check sync metadata
    const [syncInfo] = await pool.execute(`
      SELECT sync_status, last_sync_at, records_synced, error_message
      FROM sync_metadata
      WHERE entity_name = 'os'
    `);
    
    if ((syncInfo as any[]).length > 0) {
      const sync = (syncInfo as any)[0];
      console.log(chalk.blue('\nLast Sync Info:'));
      console.log(`  Status: ${sync.sync_status}`);
      console.log(`  Last Run: ${sync.last_sync_at ? new Date(sync.last_sync_at).toLocaleString() : 'Never'}`);
      console.log(`  Records Synced: ${sync.records_synced}`);
      if (sync.error_message) {
        console.log(`  Error: ${chalk.red(sync.error_message)}`);
      }
    }
    
    // Check for rate limiting issues
    const [rateLimits] = await pool.execute(`
      SELECT endpoint, is_limited, reset_time, request_count
      FROM rate_limit_tracker
      WHERE endpoint LIKE '%os%'
      ORDER BY updated_at DESC
      LIMIT 5
    `);
    
    if ((rateLimits as any[]).length > 0) {
      console.log(chalk.yellow('\nRate Limit Status:'));
      (rateLimits as any[]).forEach(rl => {
        console.log(`  ${rl.endpoint}: ${rl.is_limited ? chalk.red('LIMITED') : chalk.green('OK')} (${rl.request_count} requests)`);
      });
    }
    
    await closeConnection();
  } catch (error) {
    console.error(chalk.red('Error checking OS status:'), error);
    await closeConnection();
    process.exit(1);
  }
}

checkOsStatus();