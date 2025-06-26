import { getConnection } from '../config/database';
import { ApiClient } from '../services/api.client';
import logger from '../utils/logger';

// More aggressive rate limiting for continuous fetching
const BATCH_SIZE = 3; // Smaller batch size
const DELAY_BETWEEN_REQUESTS = 2000; // 2 seconds between requests
const DELAY_BETWEEN_BATCHES = 10000; // 10 seconds between batches
const MAX_RETRIES = 3;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchRemainingOsDetails() {
  try {
    logger.info('Starting to fetch remaining OS details...');
    
    const pool = await getConnection();
    const apiClient = ApiClient.getInstance();
    
    // Get remaining OS records that need details
    const [osRecords] = await pool.execute(`
      SELECT codigo_os, placa 
      FROM os 
      WHERE (valor_total = 0 AND quantidade_itens = 0)
      ORDER BY codigo_os
    `);
    
    const osList = osRecords as any[];
    logger.info(`Found ${osList.length} OS records still needing details`);
    
    if (osList.length === 0) {
      logger.info('All OS records have been processed!');
      
      // Show final statistics
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_os,
          SUM(CASE WHEN quantidade_itens > 0 THEN 1 ELSE 0 END) as os_with_items,
          SUM(valor_total) as total_value
        FROM os
      `);
      
      const stat = (stats as any[])[0];
      logger.info(`\nFinal Statistics:`);
      logger.info(`Total OS: ${stat.total_os}`);
      logger.info(`OS with items: ${stat.os_with_items}`);
      logger.info(`Total value: R$ ${parseFloat(stat.total_value || 0).toFixed(2)}`);
      
      process.exit(0);
    }
    
    // Process in batches with retry logic
    let totalProcessed = 0;
    let totalItems = 0;
    let successCount = 0;
    let errorCount = 0;
    let rateLimitCount = 0;
    
    for (let i = 0; i < osList.length; i += BATCH_SIZE) {
      const batch = osList.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(osList.length / BATCH_SIZE);
      
      logger.info(`\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);
      
      let batchRetries = 0;
      let batchProcessed = false;
      
      while (!batchProcessed && batchRetries < MAX_RETRIES) {
        try {
          for (const os of batch) {
            try {
              logger.debug(`Fetching OS ${os.codigo_os}`);
              
              // Fetch OS details
              const response = await apiClient.get<any>(`/os/${os.codigo_os}`);
              
              if (!response) {
                logger.warn(`No response for OS ${os.codigo_os}`);
                errorCount++;
                continue;
              }
              
              // Calculate totals from items
              let valorTotal = 0;
              let quantidadeItens = 0;
              const itemsToInsert = [];
              
              if (response.itens && Array.isArray(response.itens)) {
                quantidadeItens = response.itens.length;
                
                for (const item of response.itens) {
                  const itemValorTotal = (item.valorItem || 0) * (item.quantidade || 0);
                  valorTotal += itemValorTotal;
                  
                  itemsToInsert.push({
                    codigo_os: os.codigo_os,
                    numero_item: item.numeroItem || 0,
                    valor_item: item.valorItem || 0,
                    quantidade: item.quantidade || 0
                  });
                }
              }
              
              // Update OS record
              await pool.execute(
                `UPDATE os SET valor_total = ?, quantidade_itens = ? WHERE codigo_os = ?`,
                [valorTotal, quantidadeItens, os.codigo_os]
              );
              
              // Insert items if any
              if (itemsToInsert.length > 0) {
                const itemColumns = ['codigo_os', 'numero_item', 'valor_item', 'quantidade'];
                const placeholders = itemsToInsert.map(() => 
                  `(${itemColumns.map(() => '?').join(', ')})`
                ).join(', ');
                
                const values = itemsToInsert.flatMap(item => 
                  itemColumns.map(col => (item as any)[col])
                );
                
                const sql = `INSERT INTO os_itens (${itemColumns.join(', ')}) VALUES ${placeholders}
                  ON DUPLICATE KEY UPDATE 
                    valor_item = VALUES(valor_item),
                    quantidade = VALUES(quantidade)`;
                
                await pool.execute(sql, values);
                totalItems += itemsToInsert.length;
              }
              
              successCount++;
              totalProcessed++;
              
              // Delay between requests
              await delay(DELAY_BETWEEN_REQUESTS);
              
            } catch (error: any) {
              if (error.response?.status === 429) {
                rateLimitCount++;
                throw error; // Propagate to batch retry
              } else {
                logger.error(`Error fetching OS ${os.codigo_os}:`, error.message);
                errorCount++;
              }
            }
          }
          
          batchProcessed = true;
          
        } catch (error: any) {
          if (error.response?.status === 429) {
            batchRetries++;
            const waitTime = 60000 * batchRetries; // Exponential backoff
            logger.warn(`Rate limited on batch ${batchNumber}. Retry ${batchRetries}/${MAX_RETRIES}. Waiting ${waitTime / 1000} seconds...`);
            await delay(waitTime);
          } else {
            throw error;
          }
        }
      }
      
      if (!batchProcessed) {
        logger.error(`Failed to process batch ${batchNumber} after ${MAX_RETRIES} retries`);
        break;
      }
      
      // Progress update
      const progress = ((i + batch.length) / osList.length * 100).toFixed(1);
      logger.info(`Progress: ${progress}% (${totalProcessed}/${osList.length})`);
      logger.info(`Items fetched: ${totalItems}, Success: ${successCount}, Errors: ${errorCount}, Rate limits: ${rateLimitCount}`);
      
      // Delay between batches
      if (i + BATCH_SIZE < osList.length) {
        logger.info(`Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }
    
    // Update bi_vehicle_expenses
    logger.info('\nUpdating vehicle expenses...');
    const updateQuery = `
      INSERT INTO bi_vehicle_expenses (
        placa, codigo_mva, total_expenses, expense_count,
        first_expense_date, last_expense_date, avg_expense_value,
        max_expense_value, total_items
      )
      SELECT 
        o.placa,
        v.codigo_mva,
        SUM(oi.valor_total_item) as total_expenses,
        COUNT(DISTINCT o.codigo_os) as expense_count,
        MIN(o.data_abertura) as first_expense_date,
        MAX(o.data_abertura) as last_expense_date,
        AVG(oi.valor_total_item) as avg_expense_value,
        MAX(oi.valor_total_item) as max_expense_value,
        COUNT(oi.id) as total_items
      FROM os o
      INNER JOIN os_itens oi ON o.codigo_os = oi.codigo_os
      LEFT JOIN veiculos v ON o.placa = v.placa
      WHERE o.placa IS NOT NULL
      GROUP BY o.placa, v.codigo_mva
      ON DUPLICATE KEY UPDATE
        codigo_mva = VALUES(codigo_mva),
        total_expenses = VALUES(total_expenses),
        expense_count = VALUES(expense_count),
        first_expense_date = VALUES(first_expense_date),
        last_expense_date = VALUES(last_expense_date),
        avg_expense_value = VALUES(avg_expense_value),
        max_expense_value = VALUES(max_expense_value),
        total_items = VALUES(total_items),
        last_updated = CURRENT_TIMESTAMP
    `;
    
    await pool.execute(updateQuery);
    
    // Final summary
    logger.info('\n=== FINAL SUMMARY ===');
    logger.info(`Total OS processed: ${totalProcessed}`);
    logger.info(`Successful: ${successCount}`);
    logger.info(`Errors: ${errorCount}`);
    logger.info(`Rate limit hits: ${rateLimitCount}`);
    logger.info(`Total items inserted: ${totalItems}`);
    
    // Show top vehicles by expense
    const [topVehicles] = await pool.execute(`
      SELECT placa, total_expenses, expense_count, total_items 
      FROM bi_vehicle_expenses 
      WHERE total_expenses > 0
      ORDER BY total_expenses DESC
      LIMIT 10
    `);
    
    if ((topVehicles as any[]).length > 0) {
      logger.info('\nTop vehicles by expense:');
      (topVehicles as any[]).forEach((row, idx) => {
        const totalExpenses = parseFloat(row.total_expenses).toFixed(2);
        logger.info(`  ${idx + 1}. ${row.placa}: ${row.expense_count} OS, ${row.total_items} items, R$ ${totalExpenses}`);
      });
    }
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fetchRemainingOsDetails();
}