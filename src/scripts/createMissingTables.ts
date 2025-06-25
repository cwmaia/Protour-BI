import { getConnection } from '../config/database';
import { readFileSync } from 'fs';
import { join } from 'path';
import logger from '../utils/logger';

/**
 * Creates missing database tables required for sync operations
 */
async function createMissingTables() {
  let connection;
  
  try {
    console.log('🔧 Creating missing database tables...');
    
    // Get database connection
    connection = await getConnection();
    
    // Read SQL file
    const sqlPath = join(__dirname, 'createMissingTables.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    
    // Split SQL statements by semicolon and filter out empty statements
    // First remove all single-line comments
    const cleanedContent = sqlContent
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex).trim();
        }
        return line;
      })
      .join('\n');
    
    const statements = cleanedContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.toUpperCase().startsWith('USE'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    let successCount = 0;
    let errorCount = 0;
    
    for (const statement of statements) {
      try {
        // Skip USE statements and comments
        if (statement.toUpperCase().startsWith('USE') || statement.startsWith('--')) {
          continue;
        }
        
        await connection.execute(statement + ';');
        successCount++;
        
        // Extract table name for logging
        const tableMatch = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
        if (tableMatch) {
          console.log(`✅ Created/verified table: ${tableMatch[1]}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error executing statement:`, error);
        console.error('Statement:', statement.substring(0, 100) + '...');
        
        // Continue with other statements even if one fails
        continue;
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`✅ Successfully executed: ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`❌ Failed: ${errorCount} statements`);
    }
    
    // Verify tables were created
    console.log('\n🔍 Verifying created tables...');
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME 
       FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = 'locavia_bi' 
       AND TABLE_NAME IN ('condutores', 'veiculos', 'contratos', 'contrato_master', 'reservas', 'formas_pagamento', 'clientes')
       ORDER BY TABLE_NAME`
    );
    
    console.log('\n📋 Tables in database:');
    (tables as any[]).forEach(table => {
      console.log(`  ✓ ${table.TABLE_NAME}`);
    });
    
    // Check sync metadata
    const [syncMetadata] = await connection.execute(
      `SELECT entity_name, sync_status 
       FROM sync_metadata 
       WHERE entity_name IN ('condutores', 'veiculos', 'contratos', 'contratomaster', 'reservas', 'formas_pagamento', 'clientes')
       ORDER BY entity_name`
    );
    
    console.log('\n📊 Sync metadata status:');
    (syncMetadata as any[]).forEach(meta => {
      console.log(`  ${meta.entity_name}: ${meta.sync_status}`);
    });
    
    console.log('\n✅ Missing tables creation completed successfully!');
    
  } catch (error) {
    console.error('❌ Failed to create missing tables:', error);
    logger.error('Failed to create missing tables:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Execute if run directly
if (require.main === module) {
  createMissingTables()
    .then(() => {
      console.log('\n👍 All done!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default createMissingTables;