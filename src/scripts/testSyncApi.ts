import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config();

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
  message: string;
  data?: any;
}

class SyncApiTester {
  private apiUrl: string;
  private axios: AxiosInstance;
  private results: TestResult[] = [];

  constructor(port: number = 3050) {
    this.apiUrl = `http://localhost:${port}/api`;
    this.axios = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });
  }

  private logTest(result: TestResult) {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? chalk.green : chalk.red;
    console.log(`${icon} ${color(result.method)} ${result.endpoint} - ${result.message}`);
    if (result.data && process.argv.includes('--verbose')) {
      console.log(chalk.gray('   Response:'), JSON.stringify(result.data, null, 2));
    }
  }

  async testEndpoint(
    method: 'GET' | 'POST',
    endpoint: string,
    expectedStatus: number,
    description: string,
    data?: any
  ): Promise<TestResult> {
    try {
      const response = await this.axios.request({
        method,
        url: endpoint,
        data
      });

      const success = response.status === expectedStatus;
      const result: TestResult = {
        endpoint,
        method,
        status: response.status,
        success,
        message: success 
          ? `${description} (${response.status})`
          : `Expected ${expectedStatus}, got ${response.status}`,
        data: response.data
      };

      this.results.push(result);
      this.logTest(result);
      return result;
    } catch (error: any) {
      const result: TestResult = {
        endpoint,
        method,
        status: 0,
        success: false,
        message: `Error: ${error.message}`
      };
      this.results.push(result);
      this.logTest(result);
      return result;
    }
  }

  async runTests() {
    console.log(chalk.bold.blue('\n🚀 Testing Protour-Locavia Sync API\n'));
    console.log(chalk.gray(`API URL: ${this.apiUrl}`));
    console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}`));
    console.log(chalk.gray(`Run with --verbose to see response data\n`));

    // Check if server is running
    console.log(chalk.yellow('📡 Checking if API server is running...\n'));
    const healthCheck = await this.testEndpoint(
      'GET',
      '/health',
      200,
      'Health check endpoint'
    );

    if (healthCheck.status === 0) {
      console.log(chalk.red('\n❌ API Server is not running!'));
      console.log(chalk.yellow('Please start the API server with: npm run api:start\n'));
      return;
    }

    // Analyze health check response
    if (healthCheck.success && healthCheck.data) {
      console.log(chalk.blue('\n📊 Health Status:'));
      console.log(`   Overall: ${healthCheck.data.status}`);
      if (healthCheck.data.services) {
        console.log(`   Database: ${healthCheck.data.services.database}`);
        console.log(`   Authentication: ${healthCheck.data.services.authentication}`);
        console.log(`   Rate Limit: ${healthCheck.data.services.rateLimit?.available ? 'Available' : 'Limited'}`);
      }
    }

    // Test all endpoints
    console.log(chalk.blue('\n🧪 Testing API Endpoints...\n'));

    // GET endpoints
    await this.testEndpoint(
      'GET',
      '/sync/status',
      200,
      'Get sync status'
    );

    await this.testEndpoint(
      'GET',
      '/sync/history',
      200,
      'Get sync history'
    );

    await this.testEndpoint(
      'GET',
      '/stats/bi_dados_veiculos',
      200,
      'Get vehicle statistics'
    );

    await this.testEndpoint(
      'GET',
      '/stats/bi_dados_clientes',
      200,
      'Get client statistics'
    );

    await this.testEndpoint(
      'GET',
      '/stats/os',
      200,
      'Get OS statistics'
    );

    // Invalid endpoint test
    await this.testEndpoint(
      'GET',
      '/invalid-endpoint',
      404,
      'Invalid endpoint returns 404'
    );

    // POST endpoints
    console.log(chalk.blue('\n🧪 Testing Sync Control Endpoints...\n'));

    // First, ensure no sync is running
    const stopResult = await this.axios.post('/sync/stop');
    if (stopResult.status === 200) {
      console.log(chalk.gray('   ✓ Stopped any existing sync\n'));
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test starting sync
    const startResult = await this.testEndpoint(
      'POST',
      '/sync/start',
      200,
      'Start sync process'
    );

    if (startResult.success) {
      // Wait a bit
      console.log(chalk.gray('   Waiting 3 seconds to check sync status...'));
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if sync is running
      const statusCheck = await this.axios.get('/sync/status');
      if (statusCheck.data.isRunning) {
        console.log(chalk.green('   ✓ Sync is running'));
        console.log(chalk.gray(`   Current entity: ${statusCheck.data.currentEntity || 'None'}`));
        console.log(chalk.gray(`   Overall progress: ${statusCheck.data.overallProgress}%`));
        
        if (statusCheck.data.progress && statusCheck.data.progress.length > 0) {
          console.log(chalk.gray('\n   Progress details:'));
          statusCheck.data.progress.forEach((p: any) => {
            const status = p.status === 'completed' ? '✓' : p.status === 'running' ? '⟳' : '○';
            console.log(chalk.gray(`     ${status} ${p.entity}: ${p.percentage}% (${p.current}/${p.total})`));
          });
        }
      } else {
        console.log(chalk.red('   ✗ Sync is not running after start'));
      }

      // Test starting again (should fail)
      await this.testEndpoint(
        'POST',
        '/sync/start',
        409,
        'Cannot start sync when already running'
      );

      // Test stopping sync
      console.log(chalk.blue('\n   Testing sync stop...'));
      await this.testEndpoint(
        'POST',
        '/sync/stop',
        200,
        'Stop sync process'
      );

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Test stopping when not running
    await this.testEndpoint(
      'POST',
      '/sync/stop',
      409,
      'Cannot stop sync when not running'
    );

    // Test WebSocket availability
    console.log(chalk.blue('\n🧪 Testing WebSocket Availability...\n'));
    try {
      const wsTest = await axios.get(`http://localhost:${process.env.API_PORT || 3050}/socket.io/socket.io.js`, {
        timeout: 2000
      });
      if (wsTest.status === 200) {
        console.log(chalk.green('✅ WebSocket endpoint is available'));
      } else {
        console.log(chalk.red('❌ WebSocket endpoint returned unexpected status:', wsTest.status));
      }
    } catch (error) {
      console.log(chalk.red('❌ WebSocket endpoint is not accessible'));
    }

    // Print summary
    this.printSummary();
  }

  private printSummary() {
    console.log(chalk.bold.blue('\n📊 Test Summary\n'));

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(chalk.green(`Passed: ${passed}`));
    console.log(chalk.red(`Failed: ${failed}`));
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      this.results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`  - ${r.method} ${r.endpoint}: ${r.message}`);
        });
    }

    // Check specific requirements
    console.log(chalk.blue('\n🔍 API Readiness Checklist:'));
    const checks = {
      '✓ Health endpoint working': this.results.find(r => r.endpoint === '/health' && r.success),
      '✓ Can start sync': this.results.find(r => r.endpoint === '/sync/start' && r.method === 'POST' && r.success),
      '✓ Can stop sync': this.results.find(r => r.endpoint === '/sync/stop' && r.method === 'POST' && r.success),
      '✓ Can get sync status': this.results.find(r => r.endpoint === '/sync/status' && r.success),
      '✓ Can get sync history': this.results.find(r => r.endpoint === '/sync/history' && r.success),
      '✓ Can get entity stats': this.results.find(r => r.endpoint.startsWith('/stats/') && r.success),
      '✓ Proper error handling': this.results.find(r => r.endpoint === '/invalid-endpoint' && r.status === 404),
      '✓ Conflict detection': this.results.find(r => r.status === 409)
    };

    Object.entries(checks).forEach(([check, result]) => {
      const icon = result ? '✅' : '❌';
      const color = result ? chalk.green : chalk.red;
      console.log(`${icon} ${color(check.substring(2))}`);
    });

    const allChecksPassed = Object.values(checks).every(Boolean);
    if (allChecksPassed) {
      console.log(chalk.bold.green('\n✅ All tests passed! API is ready for BI Dashboard integration!\n'));
      console.log(chalk.yellow('📝 Next steps:'));
      console.log(chalk.gray('   1. Install dependencies in BI project: npm install axios socket.io-client'));
      console.log(chalk.gray('   2. Copy the integration code from BI_DASHBOARD_INTEGRATION_PROMPT.md'));
      console.log(chalk.gray('   3. Ensure this API server is running when testing: npm run api:start'));
      console.log(chalk.gray('   4. Connect from BI dashboard to http://localhost:3050\n'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️  Some checks failed. Please fix issues before integration.\n'));
    }
  }
}

// Run tests
async function main() {
  const port = parseInt(process.env.API_PORT || '3050', 10);
  const tester = new SyncApiTester(port);
  
  try {
    await tester.runTests();
  } catch (error) {
    console.error(chalk.red('Test runner error:'), error);
  } finally {
    process.exit(0);
  }
}

main();