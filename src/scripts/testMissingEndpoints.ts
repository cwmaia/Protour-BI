import { ApiClient } from '../services/api.client';

async function testEndpoints() {
  const apiClient = ApiClient.getInstance();
  
  const endpointsToTest = [
    // Based on Swagger documentation
    { name: 'FormaPagamento (singular)', endpoint: '/formaPagamento' },
    { name: 'FormasPagamento (plural)', endpoint: '/formasPagamento' },
    { name: 'Contrato (singular)', endpoint: '/contrato' },
    { name: 'Contratos (plural)', endpoint: '/contratos' },
    { name: 'ContratoMaster (camelCase)', endpoint: '/contratoMaster' },
    { name: 'Contratomaster (lowercase)', endpoint: '/contratomaster' },
    
    // Test different parameter combinations
    { name: 'FormaPagamento with pagination', endpoint: '/formaPagamento', params: { pagina: 1, linhas: 10 } },
    { name: 'FormaPagamento with startRow/endRow', endpoint: '/formaPagamento', params: { startRow: 0, endRow: 10 } },
    { name: 'FormaPagamento with page/limit', endpoint: '/formaPagamento', params: { page: 1, limit: 10 } },
  ];

  console.log('Testing API endpoints...\n');

  for (const test of endpointsToTest) {
    try {
      console.log(`Testing: ${test.name} - ${test.endpoint}`);
      
      const response = await apiClient.get(test.endpoint, test.params);
      
      if (response) {
        console.log(`✓ Success: ${test.endpoint}`);
        console.log(`  Response type: ${typeof response}`);
        console.log(`  Has results: ${!!(response as any).results}`);
        console.log(`  Results count: ${(response as any).results?.length || 0}`);
        console.log(`  Sample response:`, JSON.stringify(response, null, 2).substring(0, 200) + '...');
      } else {
        console.log(`⚠ Warning: ${test.endpoint} returned null or empty response`);
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`✗ Not Found (404): ${test.endpoint}`);
      } else {
        console.log(`✗ Error: ${test.endpoint} - ${error.message}`);
        if (error.response?.data) {
          console.log(`  Response:`, error.response.data);
        }
      }
    }
    console.log('---');
  }
}

testEndpoints().catch(console.error);