import { ApiClient } from '../services/api.client';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';

async function testConnection(): Promise<void> {
  const client = ApiClient.getInstance();
  
  try {
    logger.info('Testing API connection...');
    
    // Test authentication
    await (client as any).authenticate();
    logger.info('Authentication successful!');
    
    // Test a simple endpoint
    const vehicles = await client.get('/veiculos', { pagina: 1, linhas: 1 });
    logger.info('API request successful:', vehicles);
    
  } catch (error) {
    logger.error('Connection test failed:', error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  testConnection()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
}

export default testConnection;