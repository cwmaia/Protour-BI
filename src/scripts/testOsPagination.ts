import { ApiClient } from '../services/api.client';
import { getConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';

async function testOsPagination() {
  try {
    console.log(chalk.bold.cyan('\n=== Testing OS Endpoint Pagination ===\n'));
    
    const apiClient = ApiClient.getInstance();
    const osEndpoint = '/os';
    
    // Test different page sizes
    const pageSizes = [10, 50, 100, 200];
    
    for (const pageSize of pageSizes) {
      console.log(chalk.yellow(`\nTesting with page size: ${pageSize}`));
      
      let totalRecords = 0;
      let pageCount = 0;
      
      try {
        // Test manual pagination
        for (let page = 1; page <= 5; page++) {
          const response = await apiClient.get<any>(osEndpoint, { 
            pagina: page, 
            linhas: pageSize 
          });
          
          const records = response?.results || response || [];
          const recordCount = Array.isArray(records) ? records.length : 0;
          
          console.log(`  Page ${page}: ${recordCount} records`);
          totalRecords += recordCount;
          pageCount++;
          
          // Stop if we get less than requested (reached end)
          if (recordCount < pageSize) {
            console.log(chalk.green(`  Reached end of data at page ${page}`));
            break;
          }
        }
        
        console.log(chalk.blue(`  Total records fetched: ${totalRecords} across ${pageCount} pages`));
        
      } catch (error: any) {
        console.log(chalk.red(`  Error: ${error.message}`));
      }
    }
    
    // Test the paginate generator method
    console.log(chalk.yellow('\n\nTesting paginate generator method:'));
    
    let generatorTotal = 0;
    let batchCount = 0;
    
    const pageGenerator = apiClient.paginate<any>(osEndpoint, 100);
    
    for await (const batch of pageGenerator) {
      batchCount++;
      generatorTotal += batch.length;
      console.log(`  Batch ${batchCount}: ${batch.length} records (Total: ${generatorTotal})`);
      
      // Sample first record from each batch
      if (batch.length > 0) {
        const sample = batch[0];
        console.log(chalk.gray(`    Sample: OS ${sample.codigoOS}, Placa: ${sample.placa || 'N/A'}`));
      }
    }
    
    console.log(chalk.green(`\nGenerator method fetched ${generatorTotal} total records in ${batchCount} batches`));
    
    // Check database for comparison
    const pool = await getConnection();
    const [dbResult] = await pool.execute('SELECT COUNT(*) as count FROM os');
    const dbCount = (dbResult as any)[0].count;
    
    console.log(chalk.cyan(`\nDatabase currently has ${dbCount} OS records`));
    console.log(chalk.yellow(`API has ${generatorTotal} OS records available`));
    
    if (generatorTotal > dbCount) {
      console.log(chalk.red(`\n⚠️  Missing ${generatorTotal - dbCount} records in database!`));
      console.log(chalk.red(`This explains why expenses are lower than expected.`));
    }
    
    await pool.end();
    
  } catch (error) {
    logger.error('Error testing OS pagination:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testOsPagination();
}