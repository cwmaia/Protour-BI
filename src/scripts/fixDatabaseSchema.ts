import { getConnection, closeConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';
import { RowDataPacket } from 'mysql2';

async function fixDatabaseSchema(): Promise<void> {
  try {
    const pool = await getConnection();
    
    console.log(chalk.bold.cyan('\n=== Fixing Database Schema Issues ===\n'));
    
    // Fix 1: contratos.fechado column - convert from integer to varchar
    console.log(chalk.yellow('1. Fixing contratos.fechado column type...'));
    
    try {
      // First, check current column type
      const [columns] = await pool.execute<RowDataPacket[]>(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'contratos' 
        AND COLUMN_NAME = 'fechado'
      `);
      
      if (columns.length > 0) {
        console.log(`   Current type: ${columns[0].DATA_TYPE}`);
        
        // Alter column to VARCHAR(1) to accept 'S'/'N' values
        await pool.execute(`
          ALTER TABLE contratos 
          MODIFY COLUMN fechado VARCHAR(1) DEFAULT NULL
        `);
        
        console.log(chalk.green('   ✓ Column type changed to VARCHAR(1)'));
      } else {
        console.log(chalk.gray('   Column not found - may need to create table first'));
      }
    } catch (error) {
      console.error(chalk.red('   ✗ Failed to fix fechado column:'), error instanceof Error ? error.message : String(error));
    }
    
    // Fix 2: Add indexes for better performance
    console.log(chalk.yellow('\n2. Adding performance indexes...'));
    
    const indexes = [
      { table: 'os', column: 'numeroOs', name: 'idx_os_numero' },
      { table: 'os_itens', column: 'os_id', name: 'idx_os_itens_os_id' },
      { table: 'sync_metadata', column: 'last_sync_at', name: 'idx_sync_metadata_last_sync' }
    ];
    
    for (const index of indexes) {
      try {
        // Check if index exists
        const [existing] = await pool.execute<RowDataPacket[]>(`
          SELECT COUNT(*) as count 
          FROM INFORMATION_SCHEMA.STATISTICS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ? 
          AND INDEX_NAME = ?
        `, [index.table, index.name]);
        
        if (existing[0].count === 0) {
          await pool.execute(`
            CREATE INDEX ${index.name} ON ${index.table} (${index.column})
          `);
          console.log(chalk.green(`   ✓ Created index ${index.name} on ${index.table}.${index.column}`));
        } else {
          console.log(chalk.gray(`   - Index ${index.name} already exists`));
        }
      } catch (error) {
        console.error(chalk.red(`   ✗ Failed to create index ${index.name}:`), error instanceof Error ? error.message : String(error));
      }
    }
    
    // Fix 3: Ensure auth_tokens table has proper constraints
    console.log(chalk.yellow('\n3. Ensuring auth_tokens table constraints...'));
    
    try {
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          id INT PRIMARY KEY DEFAULT 1,
          token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT single_row CHECK (id = 1)
        )
      `);
      console.log(chalk.green('   ✓ auth_tokens table verified'));
    } catch (error) {
      console.error(chalk.red('   ✗ Failed to verify auth_tokens table:'), error instanceof Error ? error.message : String(error));
    }
    
    console.log(chalk.bold.green('\n✓ Database schema fixes completed!\n'));
    
  } catch (error) {
    logger.error('Database schema fix failed:', error);
    console.error(chalk.red('\n✗ Database schema fix failed:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await closeConnection();
  }
}

// Run if called directly
if (require.main === module) {
  fixDatabaseSchema();
}