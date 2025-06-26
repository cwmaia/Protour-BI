import { getConnection } from '../config/database';
import { ApiClient } from '../services/api.client';
import logger from '../utils/logger';

// Basic OS sync without detail fetching to avoid rate limiting
async function syncOsBasic() {
  try {
    logger.info('Starting basic OS sync (without item details)...');
    
    // Initialize database connection
    await getConnection();
    
    const apiClient = ApiClient.getInstance();
    const osEndpoint = '/os';
    
    // Get OS records
    const response = await apiClient.get<any>(osEndpoint, { pagina: 1, linhas: 100 });
    
    logger.debug('OS API Response:', response);
    logger.info(`Response type: ${typeof response}, isArray: ${Array.isArray(response)}`);
    
    // Check if response is wrapped in results
    const osRecords = response?.results || response;
    
    logger.info(`Fetched ${Array.isArray(osRecords) ? osRecords.length : 0} OS records`);
    
    if (Array.isArray(osRecords) && osRecords.length > 0) {
      // Insert only basic OS data without fetching details
      const pool = await getConnection();
      
      const osColumns = [
        'codigo_os', 'codigo_empresa', 'codigo_unidade', 'data_abertura',
        'placa', 'codigo_fornecedor', 'numero_documento', 'valor_total', 'quantidade_itens'
      ];
      
      const mappedRecords = osRecords.map((os: any) => ({
        codigo_os: os.codigoOS,
        codigo_empresa: os.codigoEmpresa,
        codigo_unidade: os.codigoUnidade,
        data_abertura: os.dataAbertura ? new Date(os.dataAbertura).toISOString().split('T')[0] : null,
        placa: os.placa || null,
        codigo_fornecedor: os.codigoFornecedor || null,
        numero_documento: os.numeroDocumento || null,
        valor_total: 0, // Will be updated later
        quantidade_itens: 0 // Will be updated later
      }));
      
      // Insert in batches
      const batchSize = 10;
      let totalInserted = 0;
      
      for (let i = 0; i < mappedRecords.length; i += batchSize) {
        const batch = mappedRecords.slice(i, i + batchSize);
        
        const placeholders = batch.map(() => 
          `(${osColumns.map(() => '?').join(', ')})`
        ).join(', ');
        
        const values = batch.flatMap(record => 
          osColumns.map(col => (record as any)[col] ?? null)
        );
        
        const sql = `INSERT INTO os (${osColumns.join(', ')}) VALUES ${placeholders}
          ON DUPLICATE KEY UPDATE 
            codigo_empresa = VALUES(codigo_empresa),
            codigo_unidade = VALUES(codigo_unidade),
            data_abertura = VALUES(data_abertura),
            placa = VALUES(placa),
            codigo_fornecedor = VALUES(codigo_fornecedor),
            numero_documento = VALUES(numero_documento),
            sync_date = CURRENT_TIMESTAMP`;
        
        const [result] = await pool.execute(sql, values);
        totalInserted += (result as any).affectedRows || 0;
        
        logger.info(`Inserted batch ${Math.floor(i / batchSize) + 1}, total records: ${totalInserted}`);
      }
      
      // Update sync metadata
      await pool.execute(
        `UPDATE sync_metadata 
         SET sync_status = 'completed', 
             last_sync_at = CURRENT_TIMESTAMP,
             records_synced = ?,
             error_message = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE entity_name = 'os'`,
        [totalInserted]
      );
      
      logger.info(`Basic OS sync completed! Total records: ${totalInserted}`);
      logger.info('Note: Item details and expense aggregation were skipped to avoid rate limiting');
      logger.info('Run a full sync later to fetch item details');
    } else {
      logger.warn('No OS records found or invalid response');
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during basic OS sync:', error);
    
    // Update sync metadata with error
    try {
      const pool = await getConnection();
      await pool.execute(
        `UPDATE sync_metadata 
         SET sync_status = 'failed', 
             error_message = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE entity_name = 'os'`,
        [error instanceof Error ? error.message : 'Unknown error']
      );
    } catch (metadataError) {
      logger.error('Failed to update sync metadata:', metadataError);
    }
    
    process.exit(1);
  }
}

if (require.main === module) {
  syncOsBasic();
}