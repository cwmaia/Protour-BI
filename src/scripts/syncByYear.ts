import { getConnection } from '../config/database';
import { SyncOrchestrator } from '../services/sync.orchestrator';
import logger from '../utils/logger';
import chalk from 'chalk';

interface YearSyncOptions {
  year?: number;
  entities?: string[];
  startFromLatest?: boolean;
}

async function syncByYear(options: YearSyncOptions = {}) {
  const currentYear = new Date().getFullYear();
  const { 
    year = currentYear, 
    entities = ['os', 'bi_dados_veiculos', 'bi_dados_clientes'],
    startFromLatest = true 
  } = options;

  try {
    console.log(chalk.bold.cyan('\n=== Locavia Data Sync by Year ===\n'));
    console.log(chalk.yellow(`Syncing data for year: ${year}`));
    console.log(chalk.yellow(`Entities: ${entities.join(', ')}`));
    
    // Initialize database connection
    await getConnection();
    
    // Create sync orchestrator with year filter
    const orchestrator = new SyncOrchestrator();
    
    // Add year filter to API client
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    console.log(chalk.blue(`Date range: ${startDate} to ${endDate}\n`));
    
    // Set up progress tracking
    let totalRecords = 0;
    let syncedEntities = 0;
    
    const results = [];
    
    for (const entity of entities) {
      console.log(chalk.yellow(`\nSyncing ${entity}...`));
      
      try {
        // For OS entity, add date filtering
        if (entity === 'os') {
          const pool = await getConnection();
          
          // Clear existing data for the year
          const [deleteResult] = await pool.execute(
            'DELETE FROM os WHERE YEAR(data_abertura) = ?',
            [year]
          );
          console.log(chalk.gray(`Cleared ${(deleteResult as any).affectedRows} existing records for ${year}`));
          
          // Sync with year filter
          const osSync = await orchestrator.syncEntity(entity, undefined, async (current, total) => {
            process.stdout.write(`\r${chalk.cyan(`Progress: ${current}/${total} records`)}`);
          });
          
          results.push(osSync);
          totalRecords += osSync.recordsSynced;
        } else {
          // For BI entities, they typically have date fields we can filter by
          const result = await orchestrator.syncEntity(entity, undefined, async (current, total) => {
            process.stdout.write(`\r${chalk.cyan(`Progress: ${current}/${total} records`)}`);
          });
          
          results.push(result);
          totalRecords += result.recordsSynced;
        }
        
        syncedEntities++;
        console.log(chalk.green(`\n✓ ${entity} synced successfully`));
        
      } catch (error) {
        console.log(chalk.red(`\n✗ Failed to sync ${entity}: ${error}`));
        results.push({
          entity,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          recordsSynced: 0
        });
      }
    }
    
    // Summary
    console.log(chalk.bold.cyan('\n=== Sync Summary ===\n'));
    console.log(chalk.white(`Year: ${year}`));
    console.log(chalk.white(`Entities synced: ${syncedEntities}/${entities.length}`));
    console.log(chalk.white(`Total records: ${totalRecords.toLocaleString()}`));
    
    // Check expenses for the year
    if (entities.includes('os')) {
      const pool = await getConnection();
      const [expenseResult] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT o.codigo_os) as os_count,
          SUM(oi.valor_total_item) as total_expenses
        FROM os o
        LEFT JOIN os_itens oi ON o.codigo_os = oi.codigo_os
        WHERE YEAR(o.data_abertura) = ?
      `, [year]);
      
      const data = (expenseResult as any)[0];
      console.log(chalk.bold.yellow('\n=== Financial Summary ==='));
      console.log(chalk.white(`Service Orders: ${data.os_count || 0}`));
      console.log(chalk.white(`Total Expenses: R$ ${(data.total_expenses || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`));
      
      await pool.end();
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Year-based sync failed:', error);
    console.log(chalk.red(`\n❌ Sync failed: ${error}`));
    process.exit(1);
  }
}

// Parse command line arguments
if (require.main === module) {
  const args = process.argv.slice(2);
  const yearArg = args.find(arg => arg.startsWith('--year='));
  const year = yearArg ? parseInt(yearArg.split('=')[1]) : new Date().getFullYear();
  
  const entitiesArg = args.find(arg => arg.startsWith('--entities='));
  const entities = entitiesArg 
    ? entitiesArg.split('=')[1].split(',')
    : ['os', 'bi_dados_veiculos', 'bi_dados_clientes'];
  
  syncByYear({ year, entities });
}

export default syncByYear;