import { ApiClient } from '../services/api.client';

async function testPotentialBiEndpoints() {
  const apiClient = ApiClient.getInstance();
  
  // Potential BI endpoints to test
  const potentialEndpoints = [
    '/dadosCondutores',
    '/dadosContratos',
    '/dadosReservas',
    '/dadosFinanceiro',
    '/dadosManutencao',
    '/dadosOS',
    '/dadosVeiculosDespesas',
    '/dadosDespesas',
    '/dadosReceitas',
    '/dadosFaturamento',
    '/dadosLocacoes',
    '/dadosMovimentacao',
    '/dadosMultas',
    '/dadosAbastecimento',
    '/dadosSinistros',
    '/dadosKm',
    '/dadosServicos',
    '/dadosPneus',
    '/dadosSeguro',
    '/dadosDocumentos'
  ];

  console.log('=== TESTING POTENTIAL BI ENDPOINTS ===\n');

  const found: string[] = [];
  const notFound: string[] = [];

  for (const endpoint of potentialEndpoints) {
    console.log(`Testing ${endpoint}...`);
    
    try {
      // Test with pagination parameters (BI endpoints usually support these)
      const response = await apiClient.get<any>(endpoint, {
        params: {
          pagina: 1,
          linhas: 1
        }
      });

      console.log(`✅ SUCCESS: ${endpoint}`);
      found.push(endpoint);
      
      // Show response structure
      if (response) {
        console.log(`   Has results: ${response.results ? 'YES' : 'NO'}`);
        console.log(`   Has total: ${response.total ? 'YES' : 'NO'}`);
        
        if (response.results && Array.isArray(response.results)) {
          console.log(`   Results count: ${response.results.length}`);
          console.log(`   Total records: ${response.total || 'Not provided'}`);
          
          // Show sample data structure
          if (response.results.length > 0) {
            const sampleFields = Object.keys(response.results[0]).slice(0, 5);
            console.log(`   Sample fields: ${sampleFields.join(', ')}${sampleFields.length < Object.keys(response.results[0]).length ? '...' : ''}`);
          }
        }
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`❌ NOT FOUND: ${endpoint} - 404`);
        notFound.push(endpoint);
      } else if (error.response?.status === 500) {
        console.log(`⚠️  SERVER ERROR: ${endpoint} - 500 (endpoint may exist but has errors)`);
        found.push(endpoint + ' (500 error)');
      } else {
        console.log(`❌ ERROR: ${endpoint} - ${error.response?.status || error.message}`);
        notFound.push(endpoint);
      }
    }
    
    console.log('');
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`\nFound endpoints (${found.length}):`);
  found.forEach(e => console.log(`  ✅ ${e}`));
  
  console.log(`\nNot found (${notFound.length}):`);
  notFound.forEach(e => console.log(`  ❌ ${e}`));
}

testPotentialBiEndpoints().catch(console.error);