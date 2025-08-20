import { OsSyncService } from '../services/sync/os.sync';
import { ApiClient } from '../services/api.client';
import { getConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

async function countTotalOsRecords(): Promise<number> {
  const apiClient = ApiClient.getInstance();
  let totalCount = 0;
  let page = 1;
  
  console.log(chalk.yellow('Counting total OS records...'));
  
  while (true) {
    const response = await apiClient.get<any>('/os', { pagina: page, linhas: 200 });
    const records = response?.results || response || [];
    const recordCount = Array.isArray(records) ? records.length : 0;
    
    totalCount += recordCount;
    
    if (recordCount < 200) {
      break;
    }
    
    page++;
    
    // Rate limiting: 2.5 seconds between API calls during counting
    await new Promise(resolve => setTimeout(resolve, 2500));
  }
  
  return totalCount;
}

async function syncOsComplete() {
  try {
    console.log(chalk.bold.cyan('\n=== Complete OS Sync with Progress ===\n'));
    
    // Initialize database connection
    await getConnection();
    
    // First, count total records
    const totalRecords = await countTotalOsRecords();
    console.log(chalk.green(`\nFound ${totalRecords} total OS records to sync\n`));
    
    if (totalRecords === 0) {
      console.log(chalk.red('No OS records found in API'));
      process.exit(1);
    }
    
    // Calculate expected expenses
    const expectedMonthlyExpenses = 200000; // R$ 200,000
    console.log(chalk.yellow(`Expected monthly expenses: R$ ${expectedMonthlyExpenses.toLocaleString('pt-BR')}`));
    
    // Check current database status
    const pool = await getConnection();
    const [currentCount] = await pool.execute('SELECT COUNT(*) as count FROM os');
    const currentDbCount = (currentCount as any)[0].count;
    
    const [expenseResult] = await pool.execute(`
      SELECT SUM(oi.valor_total_item) as total_expenses
      FROM os_itens oi
    `);
    const currentExpenses = (expenseResult as any)[0].total_expenses || 0;
    
    console.log(chalk.blue(`Current database: ${currentDbCount} OS records`));
    console.log(chalk.blue(`Current expenses: R$ ${currentExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
    console.log(chalk.red(`Missing: ${totalRecords - currentDbCount} records\n`));
    
    // Ask for confirmation
    console.log(chalk.yellow('This will sync ALL OS records with their details.'));
    console.log(chalk.yellow('Due to rate limiting (2.5s between calls), this may take considerable time.'));
    console.log(chalk.yellow('Estimated time: ~' + Math.ceil(totalRecords * 2.5 / 60) + ' minutes'));
    
    // Create progress bar
    const progressBar = new cliProgress.SingleBar({
      format: 'OS Sync Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value}/{total} Records | ETA: {eta}s | Duration: {duration}s',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
    
    progressBar.start(totalRecords, 0);
    
    // Create and run OS sync service with progress callback
    const osSyncService = new OsSyncService();
    
    // Override the sync method to add progress tracking
    let processedCount = 0;
    
    osSyncService.sync = async function() {
      const startTime = Date.now();
      const startedAt = new Date();
      let totalOsRecords = 0;
      let totalItemRecords = 0;

      try {
        await this.updateSyncMetadata('running');
        await this.logSyncAudit('full_sync', 0, 'started', startedAt);

        const osColumns = [
          'codigo_os', 'codigo_empresa', 'codigo_unidade', 'data_abertura',
          'placa', 'codigo_fornecedor', 'numero_documento', 'valor_total', 'quantidade_itens'
        ];

        const itemColumns = [
          'codigo_os', 'numero_item', 'valor_item', 'quantidade'
        ];

        const endpoint = '/os';
        const pageGenerator = this.apiClient.paginate<any>(endpoint, 100);
        
        for await (const batch of pageGenerator) {
          const osRecordsToInsert = [];
          const itemRecordsToInsert = [];

          for (const os of batch) {
            processedCount++;
            progressBar.update(processedCount);
            
            try {
              const osDetail = await this.apiClient.get<any>(`${endpoint}/${os.codigoOS}`);

              let valorTotal = 0;
              let quantidadeItens = 0;

              if (osDetail.itens && Array.isArray(osDetail.itens)) {
                quantidadeItens = osDetail.itens.length;
                
                for (const item of osDetail.itens) {
                  const itemValorTotal = (item.valorItem || 0) * (item.quantidade || 0);
                  valorTotal += itemValorTotal;

                  itemRecordsToInsert.push({
                    codigo_os: os.codigoOS,
                    numero_item: item.numeroItem,
                    valor_item: item.valorItem || 0,
                    quantidade: item.quantidade || 0
                  });
                }
              }

              osRecordsToInsert.push({
                codigo_os: os.codigoOS,
                codigo_empresa: os.codigoEmpresa,
                codigo_unidade: os.codigoUnidade,
                data_abertura: os.dataAbertura ? new Date(os.dataAbertura).toISOString().split('T')[0] : null,
                placa: os.placa,
                codigo_fornecedor: os.codigoFornecedor,
                numero_documento: os.numeroDocumento,
                valor_total: valorTotal,
                quantidade_itens: quantidadeItens
              });

              // Rate limiting: 2.5 seconds between API calls to avoid 429 errors
              await new Promise(resolve => setTimeout(resolve, 2500));

            } catch (error) {
              logger.error(`Failed to fetch details for OS ${os.codigoOS}:`, error);
              osRecordsToInsert.push({
                codigo_os: os.codigoOS,
                codigo_empresa: os.codigoEmpresa,
                codigo_unidade: os.codigoUnidade,
                data_abertura: os.dataAbertura ? new Date(os.dataAbertura).toISOString().split('T')[0] : null,
                placa: os.placa,
                codigo_fornecedor: os.codigoFornecedor,
                numero_documento: os.numeroDocumento,
                valor_total: os.valorTotal || 0,
                quantidade_itens: os.quantidadeItens || 0
              });
            }
          }

          if (osRecordsToInsert.length > 0) {
            const insertedOs = await this.executeBatchInsert(
              'os',
              osColumns,
              osRecordsToInsert,
              true
            );
            totalOsRecords += insertedOs;
          }

          if (itemRecordsToInsert.length > 0) {
            const insertedItems = await this.executeBatchInsert(
              'os_itens',
              itemColumns,
              itemRecordsToInsert,
              true
            );
            totalItemRecords += insertedItems;
          }
        }

        await this.updateVehicleExpenses();
        await this.updateSyncMetadata('completed', totalOsRecords);
        await this.logSyncAudit('full_sync', totalOsRecords, 'completed', startedAt, new Date());

        const duration = Date.now() - startTime;

        return {
          entity: this.entityName,
          recordsSynced: totalOsRecords,
          success: true,
          duration
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`Sync failed for ${this.entityName}:`, error);
        
        await this.updateSyncMetadata('failed', totalOsRecords, errorMessage);
        await this.logSyncAudit('full_sync', totalOsRecords, 'failed', startedAt, new Date(), errorMessage);

        return {
          entity: this.entityName,
          recordsSynced: totalOsRecords,
          success: false,
          error: errorMessage,
          duration: Date.now() - startTime
        };
      }
    };
    
    const result = await osSyncService.sync();
    
    progressBar.stop();
    
    if (result.success) {
      console.log(chalk.green(`\n✅ OS sync completed successfully!`));
      console.log(chalk.green(`Records synced: ${result.recordsSynced}`));
      console.log(chalk.green(`Duration: ${(result.duration / 1000 / 60).toFixed(2)} minutes`));
      
      // Check new database status and expenses
      const [newOsCount] = await pool.execute('SELECT COUNT(*) as count FROM os');
      const newDbCount = (newOsCount as any)[0].count;
      
      const [newItemCount] = await pool.execute('SELECT COUNT(*) as count FROM os_itens');
      const newItemDbCount = (newItemCount as any)[0].count;
      
      const [newExpenseResult] = await pool.execute(`
        SELECT 
          SUM(oi.valor_total_item) as total_expenses,
          COUNT(DISTINCT oi.codigo_os) as os_with_expenses,
          AVG(oi.valor_total_item) as avg_expense_per_item
        FROM os_itens oi
      `);
      const expenseData = (newExpenseResult as any)[0];
      const newExpenses = expenseData.total_expenses || 0;
      const osWithExpenses = expenseData.os_with_expenses || 0;
      const avgExpensePerItem = expenseData.avg_expense_per_item || 0;
      
      // Generate sync report
      console.log(chalk.bold.cyan('\n=== SYNC RESULTS REPORT ==='));
      
      console.log(chalk.bold('\n📊 Database Status:'));
      console.log(chalk.white(`  • OS Records: ${currentDbCount} → ${newDbCount} (${newDbCount > currentDbCount ? '+' : ''}${newDbCount - currentDbCount})`));
      console.log(chalk.white(`  • OS Items: ${newItemDbCount} records`));
      console.log(chalk.white(`  • OS with expenses: ${osWithExpenses}`));
      
      console.log(chalk.bold('\n💰 Financial Metrics:'));
      console.log(chalk.white(`  • Previous expenses: R$ ${currentExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
      console.log(chalk.green(`  • Current expenses: R$ ${newExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
      console.log(chalk.yellow(`  • Expense increase: R$ ${(newExpenses - currentExpenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
      console.log(chalk.white(`  • Average per item: R$ ${avgExpensePerItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
      
      const percentageOfExpected = (newExpenses / expectedMonthlyExpenses) * 100;
      console.log(chalk.bold('\n📈 Coverage Analysis:'));
      console.log(chalk.white(`  • Expected monthly: R$ ${expectedMonthlyExpenses.toLocaleString('pt-BR')}`));
      const coverageColor = percentageOfExpected >= 90 ? chalk.green : percentageOfExpected >= 70 ? chalk.yellow : chalk.red;
      console.log(coverageColor(`  • Coverage: ${percentageOfExpected.toFixed(2)}% of expected expenses`));
      
      console.log(chalk.bold('\n⏱️  Performance:'));
      console.log(chalk.white(`  • Total duration: ${(result.duration / 1000 / 60).toFixed(2)} minutes`));
      console.log(chalk.white(`  • Average per record: ${(result.duration / result.recordsSynced / 1000).toFixed(2)} seconds`));
      
      // Save results to file for documentation
      const resultsLog = {
        syncDate: new Date().toISOString(),
        recordsSynced: result.recordsSynced,
        totalOsRecords: newDbCount,
        totalItemRecords: newItemDbCount,
        totalExpenses: newExpenses,
        expenseIncrease: newExpenses - currentExpenses,
        percentageOfExpected: percentageOfExpected.toFixed(2),
        duration: result.duration,
        averageTimePerRecord: result.duration / result.recordsSynced
      };
      
      const fs = require('fs');
      const logPath = 'sync-results-os-complete.json';
      fs.writeFileSync(logPath, JSON.stringify(resultsLog, null, 2));
      console.log(chalk.gray(`\n📝 Results saved to ${logPath}`));
      
    } else {
      console.log(chalk.red(`\n❌ OS sync failed: ${result.error}`));
    }
    
    await pool.end();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    logger.error('Unexpected error during complete OS sync:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  syncOsComplete();
}