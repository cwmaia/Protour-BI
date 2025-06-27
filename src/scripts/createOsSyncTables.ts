import { getConnection, closeConnection } from '../config/database';
// import logger from '../utils/logger'; // Not used in this script
import chalk from 'chalk';

async function createOsSyncTables() {
  console.log(chalk.bold.cyan('\n=== Creating OS Sync Tracking Tables ===\n'));
  
  try {
    const pool = await getConnection();
    
    // 1. Create OS sync state table
    console.log(chalk.yellow('Creating os_sync_state table...'));
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
    console.log(chalk.green('✓ os_sync_state table created'));
    
    // 2. Create OS sync queue for pending details
    console.log(chalk.yellow('Creating os_sync_queue table...'));
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS os_sync_queue (
        codigo_os INT PRIMARY KEY,
        priority INT DEFAULT 0,
        attempts INT DEFAULT 0,
        last_attempt_at TIMESTAMP NULL,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_priority_attempts (priority DESC, attempts ASC)
      )
    `);
    console.log(chalk.green('✓ os_sync_queue table created'));
    
    // 3. Add tracking columns to OS table
    console.log(chalk.yellow('Adding sync tracking columns to os table...'));
    
    // Check which columns already exist
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'os'
    `);
    
    const existingColumns = (columns as any[]).map(c => c.COLUMN_NAME);
    
    if (!existingColumns.includes('details_synced')) {
      await pool.execute(`
        ALTER TABLE os ADD COLUMN details_synced BOOLEAN DEFAULT FALSE
      `);
      console.log(chalk.green('✓ Added details_synced column'));
    }
    
    if (!existingColumns.includes('sync_attempted_at')) {
      await pool.execute(`
        ALTER TABLE os ADD COLUMN sync_attempted_at TIMESTAMP NULL
      `);
      console.log(chalk.green('✓ Added sync_attempted_at column'));
    }
    
    if (!existingColumns.includes('sync_error')) {
      await pool.execute(`
        ALTER TABLE os ADD COLUMN sync_error TEXT NULL
      `);
      console.log(chalk.green('✓ Added sync_error column'));
    }
    
    // 4. Create indexes for efficient queries
    console.log(chalk.yellow('Creating indexes...'));
    
    try {
      await pool.execute(`
        CREATE INDEX idx_os_details_sync 
        ON os(details_synced, codigo_os)
      `);
      console.log(chalk.green('✓ Created idx_os_details_sync'));
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        throw error;
      }
      console.log(chalk.gray('✓ idx_os_details_sync already exists'));
    }
    
    try {
      await pool.execute(`
        CREATE INDEX idx_os_sync_date 
        ON os(data_abertura, codigo_os)
      `);
      console.log(chalk.green('✓ Created idx_os_sync_date'));
    } catch (error: any) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        throw error;
      }
      console.log(chalk.gray('✓ idx_os_sync_date already exists'));
    }
    
    console.log(chalk.green('✓ Indexes created'));
    
    // 5. Initialize sync state if not exists
    const [stateRows] = await pool.execute('SELECT id FROM os_sync_state WHERE id = 1');
    if ((stateRows as any[]).length === 0) {
      await pool.execute(`
        INSERT INTO os_sync_state (id, sync_status, current_phase) 
        VALUES (1, 'idle', 'headers')
      `);
      console.log(chalk.green('✓ Initialized sync state'));
    }
    
    // 6. Show current state
    const [currentState] = await pool.execute(`
      SELECT 
        COUNT(*) as total_os,
        SUM(details_synced) as with_details,
        MIN(codigo_os) as min_id,
        MAX(codigo_os) as max_id
      FROM os
    `);
    
    const stats = (currentState as any)[0];
    console.log(chalk.cyan('\nCurrent OS Data:'));
    console.log(`  Total OS records: ${stats.total_os}`);
    console.log(`  With details: ${stats.with_details || 0}`);
    console.log(`  ID range: ${stats.min_id || 'N/A'} to ${stats.max_id || 'N/A'}`);
    
    console.log(chalk.green('\n✅ All OS sync tables created successfully!'));
    
    await closeConnection();
  } catch (error) {
    console.error(chalk.red('Error creating tables:'), error);
    await closeConnection();
    process.exit(1);
  }
}

if (require.main === module) {
  createOsSyncTables();
}