import { ApiClient } from '../services/api.client';
import axios from 'axios';
import chalk from 'chalk';
import { closeConnection } from '../config/database';

interface EndpointTest {
  endpoint: string;
  description: string;
  status: 'success' | 'not_found' | 'error' | 'null_response';
  responseType?: string;
  hasData?: boolean;
  error?: string;
  recordCount?: number;
}

async function testApiEndpoints(): Promise<void> {
  const apiClient = ApiClient.getInstance();
  
  console.log(chalk.bold.cyan('\n=== Testing API Endpoints ===\n'));
  
  // List of endpoints to test based on current sync services
  const endpointsToTest = [
    // Current endpoints used in sync services
    { endpoint: '/dados/veiculos', description: 'BI Vehicles Data' },
    { endpoint: '/dados/clientes', description: 'BI Clients Data' },
    { endpoint: '/formaspagamento', description: 'Payment Methods' },
    { endpoint: '/clientes', description: 'Clients' },
    { endpoint: '/veiculos', description: 'Vehicles' },
    { endpoint: '/condutores', description: 'Drivers' },
    { endpoint: '/contratos', description: 'Contracts' },
    { endpoint: '/contratomaster', description: 'Master Contract' },
    { endpoint: '/reservas', description: 'Reservations' },
    
    // Alternative endpoint names to test
    { endpoint: '/formas-pagamento', description: 'Payment Methods (hyphenated)' },
    { endpoint: '/formasPagamento', description: 'Payment Methods (camelCase)' },
    { endpoint: '/contrato-master', description: 'Master Contract (hyphenated)' },
    { endpoint: '/contratoMaster', description: 'Master Contract (camelCase)' },
    
    // Additional endpoints that might exist
    { endpoint: '/empresas', description: 'Companies' },
    { endpoint: '/unidades', description: 'Units' },
    { endpoint: '/grupos', description: 'Groups' },
    { endpoint: '/usuarios', description: 'Users' },
    { endpoint: '/tarifas', description: 'Rates' },
    { endpoint: '/movimentacoes', description: 'Movements' },
    { endpoint: '/faturamento', description: 'Billing' },
    
    // BI endpoints
    { endpoint: '/dados/contratos', description: 'BI Contracts Data' },
    { endpoint: '/dados/reservas', description: 'BI Reservations Data' },
    { endpoint: '/dados/condutores', description: 'BI Drivers Data' },
    { endpoint: '/dados/movimentacoes', description: 'BI Movements Data' },
  ];
  
  const results: EndpointTest[] = [];
  
  // Add delay between requests to avoid rate limiting
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  
  for (const { endpoint, description } of endpointsToTest) {
    console.log(chalk.gray(`Testing ${endpoint}...`));
    
    try {
      // Use a small page size to test
      const response = await apiClient.get<any>(endpoint, { linhas: 1, pagina: 1 });
      
      // Check if response is null
      if (response === null) {
        results.push({
          endpoint,
          description,
          status: 'null_response',
          responseType: 'null',
          hasData: false,
          error: 'Endpoint returns null instead of expected data structure'
        });
      } else if (response && typeof response === 'object') {
        const hasResults = 'results' in response;
        const recordCount = hasResults && Array.isArray(response.results) ? response.results.length : 0;
        
        results.push({
          endpoint,
          description,
          status: 'success',
          responseType: hasResults ? 'paginated' : 'direct',
          hasData: recordCount > 0,
          recordCount
        });
      } else {
        results.push({
          endpoint,
          description,
          status: 'success',
          responseType: typeof response,
          hasData: false
        });
      }
      
      // Add delay to avoid rate limiting
      await delay(500);
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          results.push({
            endpoint,
            description,
            status: 'not_found',
            error: '404 - Endpoint not found'
          });
        } else if (error.response?.status === 429) {
          results.push({
            endpoint,
            description,
            status: 'error',
            error: '429 - Rate limited'
          });
          // Wait longer if rate limited
          await delay(2000);
        } else {
          results.push({
            endpoint,
            description,
            status: 'error',
            error: `${error.response?.status} - ${error.response?.statusText || error.message}`
          });
        }
      } else {
        results.push({
          endpoint,
          description,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      
      // Add delay to avoid rate limiting
      await delay(500);
    }
  }
  
  // Display results
  console.log(chalk.bold.cyan('\n\n=== API Endpoint Test Results ===\n'));
  
  // Group by status
  const successful = results.filter(r => r.status === 'success');
  const notFound = results.filter(r => r.status === 'not_found');
  const nullResponses = results.filter(r => r.status === 'null_response');
  const errors = results.filter(r => r.status === 'error');
  
  if (successful.length > 0) {
    console.log(chalk.bold.green('\n✓ Successful Endpoints:\n'));
    successful.forEach(result => {
      const dataInfo = result.hasData ? chalk.green(`${result.recordCount} records`) : chalk.yellow('no data');
      console.log(chalk.green(`  ✓ ${result.endpoint.padEnd(30)} - ${result.description.padEnd(25)} [${result.responseType}, ${dataInfo}]`));
    });
  }
  
  if (nullResponses.length > 0) {
    console.log(chalk.bold.yellow('\n⚠ Null Response Endpoints:\n'));
    nullResponses.forEach(result => {
      console.log(chalk.yellow(`  ⚠ ${result.endpoint.padEnd(30)} - ${result.description.padEnd(25)} [${result.error}]`));
    });
  }
  
  if (notFound.length > 0) {
    console.log(chalk.bold.red('\n✗ Not Found Endpoints:\n'));
    notFound.forEach(result => {
      console.log(chalk.red(`  ✗ ${result.endpoint.padEnd(30)} - ${result.description.padEnd(25)} [${result.error}]`));
    });
  }
  
  if (errors.length > 0) {
    console.log(chalk.bold.red('\n⚠ Error Endpoints:\n'));
    errors.forEach(result => {
      console.log(chalk.red(`  ⚠ ${result.endpoint.padEnd(30)} - ${result.description.padEnd(25)} [${result.error}]`));
    });
  }
  
  // Summary
  console.log(chalk.gray('\n' + '─'.repeat(80)));
  console.log(chalk.bold('\nSummary:'));
  console.log(chalk.green(`  ✓ Successful: ${successful.length}`));
  console.log(chalk.yellow(`  ⚠ Null Response: ${nullResponses.length}`));
  console.log(chalk.red(`  ✗ Not Found: ${notFound.length}`));
  console.log(chalk.red(`  ⚠ Errors: ${errors.length}`));
  console.log(chalk.cyan(`  Total Tested: ${results.length}`));
  
  // Recommendations
  console.log(chalk.bold.cyan('\n\n=== Recommendations ===\n'));
  
  if (nullResponses.length > 0) {
    console.log(chalk.yellow('1. Null Response Issues:'));
    console.log(chalk.gray('   The following endpoints return null instead of expected data:'));
    nullResponses.forEach(r => {
      console.log(chalk.gray(`   - ${r.endpoint}`));
    });
    console.log(chalk.gray('   Update the API client to handle null responses gracefully.\n'));
  }
  
  if (notFound.length > 0) {
    console.log(chalk.yellow('2. Missing Endpoints:'));
    console.log(chalk.gray('   The following endpoints don\'t exist and should be updated:'));
    notFound.forEach(r => {
      console.log(chalk.gray(`   - ${r.endpoint} (${r.description})`));
    });
    console.log(chalk.gray('   Check with the API documentation for correct endpoint names.\n'));
  }
  
  const rateLimited = errors.filter(r => r.error?.includes('429'));
  if (rateLimited.length > 0) {
    console.log(chalk.yellow('3. Rate Limiting:'));
    console.log(chalk.gray('   Some endpoints returned 429 (Too Many Requests).'));
    console.log(chalk.gray('   Implement better rate limiting with delays between requests.\n'));
  }
}

// Run if called directly
if (require.main === module) {
  testApiEndpoints()
    .then(async () => {
      await closeConnection();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(chalk.red('\nTest failed:'), error);
      await closeConnection();
      process.exit(1);
    });
}

export default testApiEndpoints;