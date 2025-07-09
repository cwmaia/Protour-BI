import { ApiClient } from '../services/api.client';
import { getConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

async function syncOsResume() {
  try {
    console.log(chalk.bold.cyan('\n=== Resuming OS Sync ===\n'));
    
    const pool = await getConnection();
    const apiClient = ApiClient.getInstance();
    
    // Get current status
    const [statusResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN valor_total > 0 THEN 1 END) as synced_with_details,
        MAX(CASE WHEN valor_total > 0 THEN codigo_os END) as last_synced_id,
        SUM(valor_total) as total_expenses
      FROM os
    `);
    
    const status = (statusResult as any)[0];
    console.log(chalk.yellow(`Current status:`));
    console.log(chalk.blue(`- Total OS records: ${status.total_count}`));
    console.log(chalk.blue(`- Synced with details: ${status.synced_with_details}`));
    console.log(chalk.blue(`- Last synced ID: ${status.last_synced_id || 0}`));
    console.log(chalk.blue(`- Total expenses: R$ ${(status.total_expenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
    
    // Get unsynced records
    const [unsyncedResult] = await pool.execute(`
      SELECT codigo_os, placa, data_abertura 
      FROM os 
      WHERE valor_total = 0 
      ORDER BY codigo_os 
      LIMIT 5000
    `);
    
    const unsyncedRecords = unsyncedResult as any[];
    console.log(chalk.green(`\nFound ${unsyncedRecords.length} records to sync\n`));
    
    if (unsyncedRecords.length === 0) {
      console.log(chalk.green('All records are synced!'));
      process.exit(0);
    }
    
    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'OS Detail Sync |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} | Rate: {rate} rec/min | ETA: {eta}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    progressBar.start(unsyncedRecords.length, 0);
    
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalExpensesAdded = 0;
    const startTime = Date.now();
    
    for (const record of unsyncedRecords) {
      try {
        // Fetch OS details
        const osDetail = await apiClient.get<any>(`/os/${record.codigo_os}`);
        
        let valorTotal = 0;
        let quantidadeItens = 0;
        const itemsToInsert = [];
        
        if (osDetail.itens && Array.isArray(osDetail.itens)) {
          quantidadeItens = osDetail.itens.length;
          
          for (const item of osDetail.itens) {
            const itemValorTotal = (item.valorItem || 0) * (item.quantidade || 0);
            valorTotal += itemValorTotal;
            
            itemsToInsert.push({
              codigo_os: record.codigo_os,
              numero_item: item.numeroItem,
              valor_item: item.valorItem || 0,
              quantidade: item.quantidade || 0
            });
          }
        }
        
        // Update OS record
        await pool.execute(
          'UPDATE os SET valor_total = ?, quantidade_itens = ?, details_synced = 1, sync_attempted_at = NOW() WHERE codigo_os = ?',
          [valorTotal, quantidadeItens, record.codigo_os]
        );
        
        // Insert items if any
        if (itemsToInsert.length > 0) {
          const placeholders = itemsToInsert.map(() => '(?, ?, ?, ?)').join(', ');
          const values = itemsToInsert.flatMap(item => [
            item.codigo_os,
            item.numero_item,
            item.valor_item,
            item.quantidade
          ]);
          
          await pool.execute(
            `INSERT INTO os_itens (codigo_os, numero_item, valor_item, quantidade) 
             VALUES ${placeholders} 
             ON DUPLICATE KEY UPDATE 
               valor_item = VALUES(valor_item),
               quantidade = VALUES(quantidade),
               sync_date = CURRENT_TIMESTAMP`,
            values
          );
        }
        
        totalExpensesAdded += valorTotal;
        successCount++;
        
        // Rate limiting - wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error: any) {
        errorCount++;
        
        if (error.response?.status === 429) {
          // Rate limited - wait longer
          console.log(chalk.yellow('\nRate limited, waiting 60s...'));
          await new Promise(resolve => setTimeout(resolve, 60000));
        } else {
          logger.error(`Failed to sync OS ${record.codigo_os}:`, error.message);
          
          // Mark as attempted
          await pool.execute(
            'UPDATE os SET sync_attempted_at = NOW(), sync_error = ? WHERE codigo_os = ?',
            [error.message || 'Unknown error', record.codigo_os]
          );
        }
      }
      
      processedCount++;
      
      // Update progress with rate
      const elapsedMinutes = (Date.now() - startTime) / 60000;
      const rate = Math.round(processedCount / elapsedMinutes);
      progressBar.update(processedCount, { rate });
      
      // Every 100 records, show intermediate stats
      if (processedCount % 100 === 0) {
        progressBar.stop();
        console.log(chalk.green(`\nCheckpoint at ${processedCount} records:`));
        console.log(chalk.blue(`- Success: ${successCount}`));
        console.log(chalk.red(`- Errors: ${errorCount}`));
        console.log(chalk.cyan(`- New expenses: R$ ${totalExpensesAdded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
        progressBar.start(unsyncedRecords.length, processedCount);
      }
    }
    
    progressBar.stop();
    
    // Final summary
    console.log(chalk.green('\n✅ Sync session completed!'));
    console.log(chalk.blue(`- Processed: ${processedCount} records`));
    console.log(chalk.blue(`- Success: ${successCount}`));
    console.log(chalk.red(`- Errors: ${errorCount}`));
    console.log(chalk.cyan(`- New expenses added: R$ ${totalExpensesAdded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
    
    // Get updated totals
    const [finalResult] = await pool.execute(`
      SELECT 
        COUNT(CASE WHEN valor_total > 0 THEN 1 END) as synced_count,
        SUM(valor_total) as total_expenses
      FROM os
    `);
    
    const final = (finalResult as any)[0];
    console.log(chalk.cyan(`\nTotal synced records: ${final.synced_count}/15000`));
    console.log(chalk.cyan(`Total expenses tracked: R$ ${(final.total_expenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    logger.error('Sync resume failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  syncOsResume();
}