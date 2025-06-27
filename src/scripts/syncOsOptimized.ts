import 'dotenv/config';
import { OptimizedOsSyncService } from '../services/sync/os.sync.optimized';
import { getConnection, closeConnection } from '../config/database';
import { tokenManager } from '../services/tokenManager';
import chalk from 'chalk';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  strategy: 'balanced' as 'fast' | 'balanced' | 'detailed',
  estimate: false
};

// Simple argument parsing
args.forEach((arg, index) => {
  if (arg === '--strategy' || arg === '-s') {
    options.strategy = args[index + 1] as any;
  } else if (arg === '--estimate' || arg === '-e') {
    options.estimate = true;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npm run sync:os-optimized [options]

Options:
  -s, --strategy <type>  Sync strategy: fast, balanced, or detailed (default: balanced)
  -e, --estimate        Estimate sync time only, do not run sync
  -h, --help           Show help

Strategies:
  fast      - Quick sync of basic OS data without item details
  balanced  - Recommended approach with smart batching (default)
  detailed  - Conservative sync with maximum retry attempts
    `);
    process.exit(0);
  }
});

async function estimateSyncTime(strategy: 'fast' | 'balanced' | 'detailed') {
  const strategies = {
    fast: { fetchDetails: false, batchSize: 200, recordsPerSecond: 50 },
    balanced: { fetchDetails: true, batchSize: 50, recordsPerSecond: 10 },
    detailed: { fetchDetails: true, batchSize: 20, recordsPerSecond: 3 }
  };

  const osSync = new OptimizedOsSyncService();
  
  // Count total records
  console.log(chalk.yellow('Counting total OS records...'));
  const totalCount = await (osSync as any).countTotalRecords();
  
  const strategyInfo = strategies[strategy];
  const estimatedSeconds = totalCount / strategyInfo.recordsPerSecond;
  const estimatedMinutes = estimatedSeconds / 60;
  const estimatedHours = estimatedMinutes / 60;

  console.log(chalk.cyan('\n=== Sync Time Estimation ==='));
  console.log(chalk.white(`Strategy: ${chalk.bold(strategy)}`));
  console.log(chalk.white(`Total Records: ${chalk.bold(totalCount.toLocaleString())}`));
  console.log(chalk.white(`Fetch Details: ${chalk.bold(strategyInfo.fetchDetails ? 'Yes' : 'No')}`));
  console.log(chalk.white(`Batch Size: ${chalk.bold(strategyInfo.batchSize)}`));
  console.log(chalk.white(`Est. Speed: ${chalk.bold(strategyInfo.recordsPerSecond)} records/second`));
  console.log(chalk.yellow(`\nEstimated Time: ${chalk.bold(
    estimatedHours >= 1 
      ? `${estimatedHours.toFixed(1)} hours` 
      : `${estimatedMinutes.toFixed(0)} minutes`
  )}`));

  return totalCount;
}

async function runOptimizedOsSync() {
  try {
    console.log(chalk.bold.cyan('\n=== Optimized OS Sync ===\n'));

    // Validate strategy
    const strategy = options.strategy as 'fast' | 'balanced' | 'detailed';
    if (!['fast', 'balanced', 'detailed'].includes(strategy)) {
      console.error(chalk.red(`Invalid strategy: ${strategy}. Use fast, balanced, or detailed.`));
      process.exit(1);
    }

    // Initialize connections
    await getConnection();
    await tokenManager.initialize();

    // Get current status
    const pool = await getConnection();
    const [currentStats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT o.codigo_os) as os_count,
        COUNT(DISTINCT oi.id) as item_count,
        COALESCE(SUM(oi.valor_total_item), 0) as total_expenses
      FROM os o
      LEFT JOIN os_itens oi ON o.codigo_os = oi.codigo_os
    `);
    
    const stats = (currentStats as any)[0];
    console.log(chalk.blue('Current Database Status:'));
    console.log(`  OS Records: ${stats.os_count}`);
    console.log(`  Item Records: ${stats.item_count}`);
    console.log(`  Total Expenses: R$ ${parseFloat(stats.total_expenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // Estimate time
    await estimateSyncTime(strategy);

    if (options.estimate) {
      console.log(chalk.yellow('\nEstimation only mode - sync not executed.'));
      await closeConnection();
      process.exit(0);
    }

    // Strategy descriptions
    const strategyDescriptions = {
      fast: 'Quick sync of basic OS data without item details. Use when you need OS headers only.',
      balanced: 'Recommended approach with smart batching and moderate rate limiting protection.',
      detailed: 'Conservative sync with maximum retry attempts and longer delays. Use for unstable APIs.'
    };

    console.log(chalk.yellow(`\nStrategy: ${chalk.bold(strategy)}`));
    console.log(chalk.gray(strategyDescriptions[strategy]));

    // Confirm before starting
    console.log(chalk.yellow('\nThis will sync OS records from the Locavia API.'));
    console.log(chalk.yellow('Press Ctrl+C to cancel, or wait 5 seconds to start...'));
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Run sync
    console.log(chalk.green('\nStarting sync...\n'));
    const osSync = new OptimizedOsSyncService();
    const result = await osSync.sync(strategy);

    // Display results
    if (result.success) {
      console.log(chalk.green('\n✅ OS Sync Completed Successfully!'));
      console.log(chalk.white('\nSync Summary:'));
      
      if (result.details) {
        const details = result.details as any;
        console.log(`  Strategy: ${details.strategy}`);
        console.log(`  OS Records: ${details.osRecords}`);
        console.log(`  Item Records: ${details.itemRecords}`);
        console.log(`  Duration: ${details.duration}`);
        console.log(`  Speed: ${details.recordsPerSecond} records/second`);
        
        if (details.skippedDetails > 0) {
          console.log(chalk.yellow(`  Skipped Details: ${details.skippedDetails}`));
        }
        if (details.rateLimitHits > 0) {
          console.log(chalk.yellow(`  Rate Limit Hits: ${details.rateLimitHits}`));
        }
      }

      // Check new expenses
      const [newStats] = await pool.execute(`
        SELECT 
          COUNT(DISTINCT o.codigo_os) as os_count,
          COUNT(DISTINCT oi.id) as item_count,
          COALESCE(SUM(oi.valor_total_item), 0) as total_expenses
        FROM os o
        LEFT JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      `);
      
      const newStatsData = (newStats as any)[0];
      const expenseIncrease = parseFloat(newStatsData.total_expenses) - parseFloat(stats.total_expenses);
      
      console.log(chalk.cyan('\nNew Database Status:'));
      console.log(`  OS Records: ${newStatsData.os_count} (+${newStatsData.os_count - stats.os_count})`);
      console.log(`  Item Records: ${newStatsData.item_count} (+${newStatsData.item_count - stats.item_count})`);
      console.log(`  Total Expenses: R$ ${parseFloat(newStatsData.total_expenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      console.log(`  Expense Increase: R$ ${expenseIncrease.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      
      // Check against expected
      const expectedMonthly = 200000;
      const percentage = (parseFloat(newStatsData.total_expenses) / expectedMonthly) * 100;
      console.log(chalk.cyan(`\nExpense Coverage: ${percentage.toFixed(1)}% of expected R$ ${expectedMonthly.toLocaleString('pt-BR')}/month`));
      
      if (percentage < 80) {
        console.log(chalk.yellow('\n⚠️  Expense coverage is below 80%. Consider running with "detailed" strategy to fetch more records.'));
      }
    } else {
      console.log(chalk.red(`\n❌ OS Sync Failed: ${result.error}`));
    }

    await closeConnection();
    tokenManager.stopAutoRefresh();
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error(chalk.red('\n❌ Unexpected error:'), error);
    await closeConnection();
    process.exit(1);
  }
}

// Add to package.json: "sync:os-optimized": "ts-node src/scripts/syncOsOptimized.ts"
if (require.main === module) {
  runOptimizedOsSync();
}