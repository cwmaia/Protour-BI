import { getConnection, closeConnection } from '../config/database';
import logger from '../utils/logger';

interface TableInfo {
  tableName: string;
  rowCount: number;
  sampleData?: any[];
  dataSize?: string;
  indexSize?: string;
  totalSize?: string;
}

async function formatBytes(bytes: number): Promise<string> {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function getTableInfo(pool: any, tableName: string): Promise<TableInfo> {
  try {
    // Get row count
    const [countResult] = await pool.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rowCount = (countResult as any)[0].count;
    
    // Get table size information
    const [sizeResult] = await pool.execute(`
      SELECT 
        data_length + index_length as total_size,
        data_length,
        index_length
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = ?
    `, [tableName]);
    
    const sizeInfo = (sizeResult as any)[0];
    
    const tableInfo: TableInfo = {
      tableName,
      rowCount,
      dataSize: sizeInfo ? await formatBytes(sizeInfo.data_length || 0) : '0 Bytes',
      indexSize: sizeInfo ? await formatBytes(sizeInfo.index_length || 0) : '0 Bytes',
      totalSize: sizeInfo ? await formatBytes(sizeInfo.total_size || 0) : '0 Bytes'
    };
    
    // Get sample data if table has rows
    if (rowCount > 0) {
      const [sampleRows] = await pool.execute(`SELECT * FROM ${tableName} LIMIT 5`);
      tableInfo.sampleData = sampleRows as any[];
    }
    
    return tableInfo;
  } catch (error) {
    logger.error(`Error getting info for table ${tableName}:`, error);
    return {
      tableName,
      rowCount: 0,
      dataSize: '0 Bytes',
      indexSize: '0 Bytes',
      totalSize: '0 Bytes'
    };
  }
}

async function checkDataStatus(): Promise<void> {
  let pool;
  
  try {
    pool = await getConnection();
    
    // Get database name
    const [dbResult] = await pool.execute('SELECT DATABASE() as db_name');
    const databaseName = (dbResult as any)[0].db_name;
    
    // Get all tables in the database
    const [tables] = await pool.execute(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    // Get database size
    const [dbSizeResult] = await pool.execute(`
      SELECT 
        SUM(data_length + index_length) as total_size
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
    `);
    const totalDbSize = await formatBytes((dbSizeResult as any)[0].total_size || 0);
    
    console.log('\n=====================================');
    console.log('       DATABASE STATUS REPORT        ');
    console.log('=====================================\n');
    
    console.log(`Database: ${databaseName}`);
    console.log(`Total Size: ${totalDbSize}`);
    console.log(`Number of Tables: ${(tables as any[]).length}`);
    console.log('\n-------------------------------------\n');
    
    const tableInfos: TableInfo[] = [];
    let totalRows = 0;
    
    // Process each table
    for (const table of (tables as any[])) {
      const tableName = table.TABLE_NAME || table.table_name;
      const tableInfo = await getTableInfo(pool, tableName);
      tableInfos.push(tableInfo);
      totalRows += tableInfo.rowCount;
    }
    
    // Display summary of tables with data
    console.log('TABLES WITH DATA:');
    console.log('-----------------');
    const tablesWithData = tableInfos.filter(t => t.rowCount > 0);
    
    if (tablesWithData.length === 0) {
      console.log('No tables contain data yet.\n');
    } else {
      for (const table of tablesWithData) {
        console.log(`\n${table.tableName}:`);
        console.log(`  - Rows: ${table.rowCount.toLocaleString()}`);
        console.log(`  - Data Size: ${table.dataSize}`);
        console.log(`  - Index Size: ${table.indexSize}`);
        console.log(`  - Total Size: ${table.totalSize}`);
      }
    }
    
    // Display empty tables
    console.log('\n\nEMPTY TABLES:');
    console.log('-------------');
    const emptyTables = tableInfos.filter(t => t.rowCount === 0);
    
    if (emptyTables.length === 0) {
      console.log('All tables contain data.\n');
    } else {
      for (const table of emptyTables) {
        console.log(`- ${table.tableName}`);
      }
    }
    
    // Display sample data from tables with data
    if (tablesWithData.length > 0) {
      console.log('\n\n=====================================');
      console.log('          SAMPLE DATA                ');
      console.log('=====================================\n');
      
      for (const table of tablesWithData) {
        console.log(`\n${table.tableName} (showing up to 5 rows):`);
        console.log('----------------------------------------');
        
        if (table.sampleData && table.sampleData.length > 0) {
          // Get column names
          const columns = Object.keys(table.sampleData[0]);
          
          // Display data in a formatted way
          table.sampleData.forEach((row, index) => {
            console.log(`\nRow ${index + 1}:`);
            columns.forEach(col => {
              const value = row[col];
              const displayValue = value === null ? 'NULL' : 
                                 value instanceof Date ? value.toISOString() : 
                                 String(value);
              console.log(`  ${col}: ${displayValue}`);
            });
          });
        }
      }
    }
    
    // Check sync metadata specifically
    console.log('\n\n=====================================');
    console.log('         SYNC STATUS                 ');
    console.log('=====================================\n');
    
    const [syncRows] = await pool.execute(`
      SELECT 
        entity_name,
        sync_status,
        last_sync_at,
        records_synced,
        error_message,
        updated_at
      FROM sync_metadata 
      ORDER BY entity_name
    `);
    
    if ((syncRows as any[]).length === 0) {
      console.log('No sync metadata found.\n');
    } else {
      for (const sync of (syncRows as any[])) {
        console.log(`${sync.entity_name}:`);
        console.log(`  Status: ${sync.sync_status}`);
        console.log(`  Last Sync: ${sync.last_sync_at ? new Date(sync.last_sync_at).toLocaleString() : 'Never'}`);
        console.log(`  Records Synced: ${sync.records_synced || 0}`);
        console.log(`  Last Updated: ${new Date(sync.updated_at).toLocaleString()}`);
        if (sync.error_message) {
          console.log(`  Error: ${sync.error_message}`);
        }
        console.log('');
      }
    }
    
    // Summary
    console.log('\n=====================================');
    console.log('           SUMMARY                   ');
    console.log('=====================================\n');
    console.log(`Total Database Size: ${totalDbSize}`);
    console.log(`Total Tables: ${tableInfos.length}`);
    console.log(`Tables with Data: ${tablesWithData.length}`);
    console.log(`Empty Tables: ${emptyTables.length}`);
    console.log(`Total Rows Across All Tables: ${totalRows.toLocaleString()}`);
    console.log('\n');
    
  } catch (error) {
    logger.error('Database status check failed:', error);
    console.error('\nError checking database status:', error);
  } finally {
    if (pool) {
      await closeConnection();
    }
  }
}

// Run the script if called directly
if (require.main === module) {
  checkDataStatus()
    .then(() => {
      console.log('Database status check completed.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default checkDataStatus;