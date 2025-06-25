import { SyncOrchestrator } from '../services/sync.orchestrator';
import { closeConnection } from '../config/database';
import chalk from 'chalk';

async function syncStatus(): Promise<void> {
  const orchestrator = new SyncOrchestrator();
  
  try {
    console.log(chalk.bold.cyan('\n=== Locavia Sync Status ===\n'));
    
    // Get current sync status
    const status = await orchestrator.getSyncStatus();
    
    // Table header
    console.log(
      chalk.gray('Entity'.padEnd(20)) +
      chalk.gray('Status'.padEnd(15)) +
      chalk.gray('Last Sync'.padEnd(25)) +
      chalk.gray('Records'.padEnd(10)) +
      chalk.gray('Error')
    );
    console.log(chalk.gray('─'.repeat(90)));
    
    // Display status for each entity
    status.forEach(row => {
      const entityName = row.entity_name.padEnd(20);
      
      let statusText = row.sync_status.padEnd(15);
      let statusColor = chalk.yellow;
      
      if (row.sync_status === 'completed') {
        statusColor = chalk.green;
      } else if (row.sync_status === 'failed') {
        statusColor = chalk.red;
      } else if (row.sync_status === 'running') {
        statusColor = chalk.blue;
      }
      
      const lastSync = row.last_sync_at 
        ? new Date(row.last_sync_at).toLocaleString().padEnd(25)
        : 'Never'.padEnd(25);
      
      const records = row.records_synced.toString().padEnd(10);
      const error = row.error_message ? chalk.red(row.error_message.substring(0, 40) + '...') : '';
      
      console.log(
        entityName +
        statusColor(statusText) +
        chalk.gray(lastSync) +
        chalk.cyan(records) +
        error
      );
    });
    
    console.log(chalk.gray('\n─'.repeat(90)));
    
    // Summary statistics
    const completed = status.filter(s => s.sync_status === 'completed').length;
    const failed = status.filter(s => s.sync_status === 'failed').length;
    const running = status.filter(s => s.sync_status === 'running').length;
    const pending = status.filter(s => s.sync_status === 'pending').length;
    const totalRecords = status.reduce((sum, s) => sum + (s.records_synced || 0), 0);
    
    console.log('\n' + chalk.bold('Summary:'));
    console.log(chalk.green(`  ✓ Completed: ${completed}`));
    console.log(chalk.red(`  ✗ Failed: ${failed}`));
    console.log(chalk.blue(`  ⚡ Running: ${running}`));
    console.log(chalk.yellow(`  ⏳ Pending: ${pending}`));
    console.log(chalk.cyan(`  📊 Total Records: ${totalRecords.toLocaleString()}`));
    
    // Show recent sync history
    console.log('\n' + chalk.bold.cyan('=== Recent Sync History ===\n'));
    
    const history = await orchestrator.getRecentSyncHistory(10);
    
    if (history.length > 0) {
      console.log(
        chalk.gray('Entity'.padEnd(20)) +
        chalk.gray('Operation'.padEnd(15)) +
        chalk.gray('Records'.padEnd(10)) +
        chalk.gray('Status'.padEnd(12)) +
        chalk.gray('Duration'.padEnd(10)) +
        chalk.gray('Started At')
      );
      console.log(chalk.gray('─'.repeat(90)));
      
      history.forEach(record => {
        const entity = record.entity_name.padEnd(20);
        const operation = record.operation.padEnd(15);
        const recordCount = record.record_count.toString().padEnd(10);
        
        let statusText = record.status.padEnd(12);
        let statusColor = chalk.green;
        if (record.status === 'failed') {
          statusColor = chalk.red;
        } else if (record.status === 'started') {
          statusColor = chalk.yellow;
        }
        
        const duration = record.duration_seconds 
          ? `${record.duration_seconds}s`.padEnd(10)
          : 'N/A'.padEnd(10);
        
        const startedAt = new Date(record.started_at).toLocaleString();
        
        console.log(
          entity +
          chalk.gray(operation) +
          chalk.cyan(recordCount) +
          statusColor(statusText) +
          chalk.gray(duration) +
          chalk.gray(startedAt)
        );
      });
    } else {
      console.log(chalk.gray('No sync history available.'));
    }
    
  } catch (error) {
    console.error(chalk.red('Error fetching sync status:'), error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  syncStatus()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

export default syncStatus;