import { getConnection } from '../config/database';
import { ApiClient } from '../services/api.client';
import logger from '../utils/logger';

// Configuration for rate limiting
const BATCH_SIZE = 5; // Process 5 OS at a time
const DELAY_BETWEEN_REQUESTS = 1000; // 1 second between requests
const DELAY_BETWEEN_BATCHES = 5000; // 5 seconds between batches

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchOsDetails() {
  try {
    logger.info('Starting OS detail fetching with rate limiting...');
    
    const pool = await getConnection();
    const apiClient = ApiClient.getInstance();
    
    // Get OS records that need details (valor_total = 0 or quantidade_itens = 0)
    const [osRecords] = await pool.execute(`
      SELECT codigo_os, placa 
      FROM os 
      WHERE valor_total = 0 OR quantidade_itens = 0
      ORDER BY codigo_os
      LIMIT 20
    `);
    
    const osList = osRecords as any[];
    logger.info(`Found ${osList.length} OS records needing details`);
    
    if (osList.length === 0) {
      logger.info('No OS records need detail fetching');
      process.exit(0);
    }
    
    // Process in batches
    let totalProcessed = 0;
    let totalItems = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < osList.length; i += BATCH_SIZE) {
      const batch = osList.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      
      logger.info(`\nProcessing batch ${batchNumber} (${batch.length} records)...`);
      
      for (const os of batch) {
        try {
          logger.info(`Fetching details for OS ${os.codigo_os} (placa: ${os.placa || 'N/A'})`);
          
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
          
          // Update OS record with calculated totals
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
          
          logger.info(`✓ OS ${os.codigo_os}: ${quantidadeItens} items, total value: ${valorTotal.toFixed(2)}`);
          successCount++;
          totalProcessed++;
          
          // Delay between requests
          await delay(DELAY_BETWEEN_REQUESTS);
          
        } catch (error: any) {
          if (error.response?.status === 429) {
            logger.error(`Rate limited at OS ${os.codigo_os}. Waiting 60 seconds...`);
            await delay(60000); // Wait 1 minute on rate limit
            i -= BATCH_SIZE; // Retry this batch
            break; // Exit inner loop to retry batch
          } else {
            logger.error(`Error fetching OS ${os.codigo_os}:`, error.message);
            errorCount++;
          }
        }
      }
      
      // Delay between batches
      if (i + BATCH_SIZE < osList.length) {
        logger.info(`Batch ${batchNumber} complete. Waiting ${DELAY_BETWEEN_BATCHES / 1000} seconds before next batch...`);
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
    
    const [result] = await pool.execute(updateQuery);
    logger.info(`Vehicle expenses updated for ${(result as any).affectedRows} vehicles`);
    
    // Summary
    logger.info('\n=== SUMMARY ===');
    logger.info(`Total OS processed: ${totalProcessed}`);
    logger.info(`Successful: ${successCount}`);
    logger.info(`Errors: ${errorCount}`);
    logger.info(`Total items inserted: ${totalItems}`);
    
    // Show sample results
    const [sampleExpenses] = await pool.execute(`
      SELECT placa, total_expenses, expense_count, total_items 
      FROM bi_vehicle_expenses 
      LIMIT 5
    `);
    
    if ((sampleExpenses as any[]).length > 0) {
      logger.info('\nSample vehicle expenses:');
      (sampleExpenses as any[]).forEach(row => {
        const totalExpenses = row.total_expenses ? parseFloat(row.total_expenses).toFixed(2) : '0.00';
        logger.info(`  ${row.placa}: ${row.expense_count} OS, ${row.total_items} items, R$ ${totalExpenses}`);
      });
    }
    
    await pool.end();
    process.exit(0);
    
  } catch (error) {
    logger.error('Fatal error in OS detail fetching:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  fetchOsDetails();
}