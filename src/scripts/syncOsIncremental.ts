import 'dotenv/config';
import { IncrementalOsSyncService } from '../services/sync/os.sync.incremental';
import { getConnection, closeConnection } from '../config/database';
import { tokenManager } from '../services/tokenManager';
import chalk from 'chalk';

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  mode: 'incremental' as 'full' | 'incremental' | 'resume' | 'details-only',
  fetchDetails: true,
  maxRecords: undefined as number | undefined,
  showProgress: true
};

// Simple argument parsing
args.forEach((arg, index) => {
  if (arg === '--mode' || arg === '-m') {
    options.mode = args[index + 1] as any;
  } else if (arg === '--no-details') {
    options.fetchDetails = false;
  } else if (arg === '--max' || arg === '-x') {
    options.maxRecords = parseInt(args[index + 1]);
  } else if (arg === '--no-progress') {
    options.showProgress = false;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: npm run sync:os-incremental [options]

Options:
  -m, --mode <type>    Sync mode: full, incremental, resume, details-only (default: incremental)
  --no-details         Skip fetching details (headers only)
  -x, --max <number>   Maximum records to sync
  --no-progress        Disable progress bar
  -h, --help          Show help

Modes:
  incremental  - Sync only new records since last sync (default)
  full        - Sync all records from beginning
  resume      - Resume from last interrupted sync
  details-only - Only sync details for existing headers

Examples:
  npm run sync:os-incremental                    # Incremental sync with details
  npm run sync:os-incremental --mode full --max 1000  # Full sync, max 1000 records
  npm run sync:os-incremental --no-details       # Headers only, no details
  npm run sync:os-incremental --mode details-only # Fetch missing details
    `);
    process.exit(0);
  }
});

async function showCurrentStatus() {
  const pool = await getConnection();
  
  // Get sync state
  const [stateRows] = await pool.execute('SELECT * FROM os_sync_state WHERE id = 1');
  const state = (stateRows as any)[0];
  
  // Get current statistics
  const [stats] = await pool.execute(`
    SELECT 
      COUNT(*) as total_os,
      SUM(details_synced) as with_details,
      SUM(CASE WHEN details_synced = 0 THEN 1 ELSE 0 END) as without_details,
      MIN(codigo_os) as min_id,
      MAX(codigo_os) as max_id,
      COUNT(DISTINCT placa) as vehicles
    FROM os
  `);
  
  const data = (stats as any)[0];
  
  console.log(chalk.cyan('\nCurrent Sync Status:'));
  console.log(`  Status: ${state?.sync_status || 'Never synced'}`);
  console.log(`  Phase: ${state?.current_phase || 'N/A'}`);
  console.log(`  Last Sync: ${state?.updated_at ? new Date(state.updated_at).toLocaleString() : 'Never'}`);
  if (state?.highest_os_id) {
    console.log(`  Highest OS ID: ${state.highest_os_id}`);
  }
  
  console.log(chalk.cyan('\nDatabase Statistics:'));
  console.log(`  Total OS: ${data.total_os}`);
  console.log(`  With Details: ${data.with_details || 0} (${((data.with_details / data.total_os) * 100).toFixed(1)}%)`);
  console.log(`  Without Details: ${data.without_details || 0}`);
  console.log(`  Vehicles: ${data.vehicles}`);
  console.log(`  ID Range: ${data.min_id || 'N/A'} to ${data.max_id || 'N/A'}`);
  
  // Get expense totals
  const [expenses] = await pool.execute(`
    SELECT 
      COALESCE(SUM(valor_total_item), 0) as total_expenses,
      COUNT(*) as total_items
    FROM os_itens
  `);
  
  const expenseData = (expenses as any)[0];
  console.log(chalk.cyan('\nExpense Summary:'));
  console.log(`  Total Items: ${expenseData.total_items}`);
  console.log(`  Total Expenses: R$ ${parseFloat(expenseData.total_expenses).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  const expectedMonthly = 200000;
  const percentage = (parseFloat(expenseData.total_expenses) / expectedMonthly) * 100;
  console.log(`  Coverage: ${percentage.toFixed(1)}% of expected R$ ${expectedMonthly.toLocaleString('pt-BR')}/month`);
}

async function runIncrementalSync() {
  try {
    console.log(chalk.bold.cyan('\n=== Incremental OS Sync ===\n'));

    // Validate mode
    if (!['full', 'incremental', 'resume', 'details-only'].includes(options.mode)) {
      console.error(chalk.red(`Invalid mode: ${options.mode}`));
      process.exit(1);
    }

    // Initialize
    await getConnection();
    await tokenManager.initialize();

    // Show current status
    await showCurrentStatus();

    // Confirm before starting
    console.log(chalk.yellow(`\nSync Configuration:`));
    console.log(`  Mode: ${options.mode}`);
    console.log(`  Fetch Details: ${options.fetchDetails ? 'Yes' : 'No'}`);
    console.log(`  Max Records: ${options.maxRecords || 'No limit'}`);
    
    if (options.mode === 'full') {
      console.log(chalk.red('\n[WARNING]  WARNING: Full sync will process ALL records from the beginning!'));
    }

    console.log(chalk.yellow('\nPress Ctrl+C to cancel, or wait 5 seconds to start...'));
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Create tables if needed
    console.log(chalk.gray('\nEnsuring sync tables exist...'));
    const pool = await getConnection();
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS os_sync_state (
        id INT PRIMARY KEY DEFAULT 1,
        last_sync_date DATE,
        last_sync_os_id INT,
        highest_os_id INT,
        total_synced INT DEFAULT 0,
        total_details_synced INT DEFAULT 0,
        sync_status ENUM('idle', 'running', 'paused', 'failed') DEFAULT 'idle',
        current_phase ENUM('headers', 'details', 'complete') DEFAULT 'headers',
        last_error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT os_sync_state_single_row CHECK (id = 1)
      )
    `);

    // Run sync
    console.log(chalk.green('\nStarting sync...\n'));
    const osSync = new IncrementalOsSyncService();
    const result = await osSync.sync({
      mode: options.mode,
      fetchDetails: options.fetchDetails,
      maxRecords: options.maxRecords,
      showProgress: options.showProgress
    });

    // Display results
    if (result.success) {
      console.log(chalk.green('\n[OK] OS Sync Completed Successfully!'));
      console.log(chalk.white('\nSync Summary:'));
      
      if (result.details) {
        const details = result.details as any;
        console.log(`  Mode: ${details.mode}`);
        console.log(`  Headers Synced: ${details.headersSync}`);
        console.log(`  Items Synced: ${details.itemsSync}`);
        console.log(`  Skipped Existing: ${details.skippedExisting}`);
        console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
      }

      // Show new status
      await showCurrentStatus();
      
      // Recommendations
      if (!options.fetchDetails) {
        console.log(chalk.yellow('\n[TIP] Tip: Run with --mode details-only to fetch missing details'));
      }
      if (result.details && (result.details as any).skippedExisting > 0) {
        console.log(chalk.green(`\n[OK] Skipped ${(result.details as any).skippedExisting} existing records (incremental sync working!)`));
      }
    } else {
      console.log(chalk.red('\n[FAIL] OS Sync Failed: ' + result.error));
      console.log(chalk.yellow('\n[TIP] Tip: Try running with --mode resume to continue from where it failed'));
    }

    await closeConnection();
    tokenManager.stopAutoRefresh();
    process.exit(result.success ? 0 : 1);

  } catch (error) {
    console.error(chalk.red('\n[FAIL] Unexpected error:'), error);
    await closeConnection();
    process.exit(1);
  }
}

if (require.main === module) {
  runIncrementalSync();
}
