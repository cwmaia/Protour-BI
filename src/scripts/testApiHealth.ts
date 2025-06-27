import 'dotenv/config';
import { ApiClient } from '../services/api.client';
import { tokenManager } from '../services/tokenManager';
import chalk from 'chalk';

async function testApiHealth() {
  console.log(chalk.bold.cyan('\n=== API Health Check ===\n'));
  
  try {
    // Initialize token manager
    await tokenManager.initialize();
    
    const apiClient = ApiClient.getInstance();
    const endpoints = [
      { name: 'OS List', endpoint: '/os', params: { pagina: 1, linhas: 1 } },
      { name: 'OS Detail', endpoint: '/os/1', params: {} },
      { name: 'BI Vehicles', endpoint: '/dadosVeiculos', params: { pagina: 1, linhas: 1 } },
      { name: 'BI Clients', endpoint: '/dadosClientes', params: { pagina: 1, linhas: 1 } }
    ];
    
    for (const test of endpoints) {
      process.stdout.write(`Testing ${test.name}... `);
      const startTime = Date.now();
      
      try {
        const response = await apiClient.get(test.endpoint, test.params);
        const duration = Date.now() - startTime;
        const hasData = response && ((response as any).results || response);
        console.log(chalk.green(`✓ OK (${duration}ms)${hasData ? ' - Has data' : ' - No data'}`));
      } catch (error: any) {
        const duration = Date.now() - startTime;
        if (error.response?.status === 429) {
          console.log(chalk.yellow(`⚠ Rate Limited (${duration}ms)`));
        } else if (error.response?.status === 500) {
          console.log(chalk.red(`✗ Server Error (${duration}ms)`));
        } else if (error.response?.status === 404) {
          console.log(chalk.gray(`- Not Found (${duration}ms)`));
        } else {
          console.log(chalk.red(`✗ Failed: ${error.message} (${duration}ms)`));
        }
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(chalk.cyan('\nAPI Health Summary:'));
    console.log('- If seeing 500 errors, wait for API to stabilize');
    console.log('- If seeing 429 errors, reduce request frequency');
    console.log('- Green checks indicate endpoints are healthy');
    
    tokenManager.stopAutoRefresh();
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('Health check failed:'), error);
    process.exit(1);
  }
}

testApiHealth();