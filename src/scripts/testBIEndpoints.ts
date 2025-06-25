import { ApiClient } from '../services/api.client';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';

async function testBIEndpoints(): Promise<void> {
  const client = ApiClient.getInstance();
  
  try {
    logger.info('Testing BI endpoints...');
    
    // Test dadosVeiculos endpoint
    logger.info('Testing /dadosVeiculos endpoint...');
    const vehicleData = await client.get('/dadosVeiculos', { 
      pagina: 1, 
      linhas: 5 
    });
    logger.info(`Vehicle BI data received:`, vehicleData);
    
    // Test dadosClientes endpoint
    logger.info('Testing /dadosClientes endpoint...');
    const clientData = await client.get('/dadosClientes', { 
      pagina: 1, 
      linhas: 5,
      dataInicio: '2025-01-01',
      dataFim: '2025-06-25',
      tipoConsulta: 'R'
    });
    logger.info(`Client BI data received:`, clientData);
    
  } catch (error) {
    logger.error('BI endpoints test failed:', error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  testBIEndpoints()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
}

export default testBIEndpoints;