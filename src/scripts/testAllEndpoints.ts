import { ApiClient } from '../services/api.client';
import { closeConnection } from '../config/database';
import logger from '../utils/logger';
import chalk from 'chalk';

async function testAllEndpoints(): Promise<void> {
  const client = ApiClient.getInstance();
  
  const endpoints = [
    { name: 'clientes', path: '/clientes' },
    { name: 'veiculos', path: '/veiculos' },
    { name: 'condutores', path: '/condutores' },
    { name: 'contratos', path: '/contratos' },
    { name: 'contratomaster', path: '/contratomaster' },
    { name: 'reservas', path: '/reservas' },
    { name: 'formas_pagamento', path: '/formaspagamento' },
    { name: 'formas_pagamento_alt', path: '/formasPagamento' },
    { name: 'dados_veiculos', path: '/dadosVeiculos' },
    { name: 'dados_clientes', path: '/dadosClientes' }
  ];
  
  try {
    console.log(chalk.bold.cyan('\n=== Testing Locavia API Endpoints ===\n'));
    
    for (const endpoint of endpoints) {
      try {
        // Test without pagination first
        const response = await client.get(endpoint.path, {});
        console.log(chalk.green(`✓ ${endpoint.name.padEnd(20)} ${endpoint.path.padEnd(20)} OK - Got ${Array.isArray(response) ? response.length : '?'} records`));
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(chalk.red(`✗ ${endpoint.name.padEnd(20)} ${endpoint.path.padEnd(20)} NOT FOUND`));
        } else if (error.response?.status === 400) {
          // Try with pagination
          try {
            await client.get(endpoint.path, { pagina: 1, linhas: 1 });
            console.log(chalk.yellow(`⚠ ${endpoint.name.padEnd(20)} ${endpoint.path.padEnd(20)} REQUIRES PAGINATION`));
          } catch (err) {
            console.log(chalk.red(`✗ ${endpoint.name.padEnd(20)} ${endpoint.path.padEnd(20)} BAD REQUEST: ${error.response?.data?.data?.message || error.message}`));
          }
        } else {
          console.log(chalk.red(`✗ ${endpoint.name.padEnd(20)} ${endpoint.path.padEnd(20)} ERROR: ${error.message}`));
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
  } catch (error) {
    logger.error('Endpoint test failed:', error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  testAllEndpoints()
    .then(() => {
      logger.info('Test completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Test failed:', error);
      process.exit(1);
    });
}

export default testAllEndpoints;