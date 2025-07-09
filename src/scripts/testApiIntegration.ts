import axios, { AxiosInstance } from 'axios';
import { io, Socket } from 'socket.io-client';
import chalk from 'chalk';
import dotenv from 'dotenv';
import { getConnection } from '../config/database';
import logger from '../utils/logger';

dotenv.config();

interface TestResult {
  test: string;
  status: 'pass' | 'fail';
  message: string;
  details?: any;
}

class ApiIntegrationTester {
  private apiUrl: string;
  private axios: AxiosInstance;
  private socket: Socket | null = null;
  private results: TestResult[] = [];

  constructor(port: number = 3050) {
    this.apiUrl = `http://localhost:${port}/api`;
    this.axios = axios.create({
      baseURL: this.apiUrl,
      timeout: 10000,
      validateStatus: () => true // Don't throw on any status
    });
  }

  private addResult(test: string, status: 'pass' | 'fail', message: string, details?: any) {
    this.results.push({ test, status, message, details });
    const icon = status === 'pass' ? '✅' : '❌';
    const color = status === 'pass' ? chalk.green : chalk.red;
    console.log(`${icon} ${color(test)}: ${message}`);
    if (details) {
      console.log(chalk.gray('   Details:'), details);
    }
  }

  async testHealthEndpoint(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing Health Endpoint...'));
    
    try {
      const response = await this.axios.get('/health');
      
      if (response.status === 200) {
        const data = response.data;
        
        // Check response structure
        if (data.status && data.services && data.timestamp) {
          this.addResult(
            'Health Endpoint Structure',
            'pass',
            'Response has correct structure',
            { 
              status: data.status,
              database: data.services.database,
              authentication: data.services.authentication,
              rateLimit: data.services.rateLimit
            }
          );
          
          // Check service statuses
          if (data.status === 'healthy') {
            this.addResult('Health Status', 'pass', 'Service is healthy');
          } else {
            this.addResult('Health Status', 'fail', 'Service is not healthy', data);
          }
          
          // Check individual services
          if (data.services.database === 'connected') {
            this.addResult('Database Connection', 'pass', 'Database is connected');
          } else {
            this.addResult('Database Connection', 'fail', 'Database is not connected');
          }
          
          if (data.services.authentication === 'valid') {
            this.addResult('Authentication', 'pass', 'Authentication token is valid');
          } else {
            this.addResult('Authentication', 'fail', 'Authentication token is invalid');
          }
          
        } else {
          this.addResult('Health Endpoint Structure', 'fail', 'Invalid response structure', data);
        }
      } else {
        this.addResult('Health Endpoint', 'fail', `HTTP ${response.status}`, response.data);
      }
    } catch (error) {
      this.addResult('Health Endpoint', 'fail', 'Request failed', error.message);
    }
  }

  async testSyncStatusEndpoint(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing Sync Status Endpoint...'));
    
    try {
      const response = await this.axios.get('/sync/status');
      
      if (response.status === 200) {
        const data = response.data;
        
        // Check response structure
        if (
          typeof data.isRunning === 'boolean' &&
          Array.isArray(data.progress) &&
          typeof data.overallProgress === 'number' &&
          Array.isArray(data.errors)
        ) {
          this.addResult(
            'Sync Status Structure',
            'pass',
            'Response has correct structure',
            {
              isRunning: data.isRunning,
              progressCount: data.progress.length,
              overallProgress: data.overallProgress,
              errorCount: data.errors.length
            }
          );
        } else {
          this.addResult('Sync Status Structure', 'fail', 'Invalid response structure', data);
        }
      } else {
        this.addResult('Sync Status Endpoint', 'fail', `HTTP ${response.status}`, response.data);
      }
    } catch (error) {
      this.addResult('Sync Status Endpoint', 'fail', 'Request failed', error.message);
    }
  }

  async testSyncStartStopEndpoints(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing Sync Start/Stop Endpoints...'));
    
    // Test starting sync
    try {
      const startResponse = await this.axios.post('/sync/start');
      
      if (startResponse.status === 200) {
        this.addResult('Sync Start', 'pass', 'Sync started successfully', startResponse.data);
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check status
        const statusResponse = await this.axios.get('/sync/status');
        if (statusResponse.data.isRunning) {
          this.addResult('Sync Running', 'pass', 'Sync is running after start');
        } else {
          this.addResult('Sync Running', 'fail', 'Sync is not running after start');
        }
        
        // Test stopping sync
        const stopResponse = await this.axios.post('/sync/stop');
        
        if (stopResponse.status === 200) {
          this.addResult('Sync Stop', 'pass', 'Sync stopped successfully', stopResponse.data);
        } else {
          this.addResult('Sync Stop', 'fail', `HTTP ${stopResponse.status}`, stopResponse.data);
        }
        
      } else if (startResponse.status === 409) {
        this.addResult('Sync Start', 'pass', 'Correctly rejected - sync already running', startResponse.data);
        
        // Try to stop it
        const stopResponse = await this.axios.post('/sync/stop');
        if (stopResponse.status === 200) {
          this.addResult('Sync Stop', 'pass', 'Existing sync stopped successfully');
        }
      } else {
        this.addResult('Sync Start', 'fail', `HTTP ${startResponse.status}`, startResponse.data);
      }
    } catch (error) {
      this.addResult('Sync Start/Stop', 'fail', 'Request failed', error.message);
    }
  }

  async testWebSocketConnection(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing WebSocket Connection...'));
    
    return new Promise((resolve) => {
      const socketUrl = this.apiUrl.replace('/api', '');
      this.socket = io(socketUrl, {
        timeout: 5000,
        reconnection: false
      });
      
      const timeout = setTimeout(() => {
        this.addResult('WebSocket Connection', 'fail', 'Connection timeout');
        this.socket?.disconnect();
        resolve();
      }, 5000);
      
      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.addResult('WebSocket Connection', 'pass', 'Connected successfully');
        
        // Test receiving status
        this.socket?.once('sync:status', (status) => {
          this.addResult('WebSocket Status Event', 'pass', 'Received status on connection', {
            isRunning: status.isRunning,
            progressCount: status.progress?.length || 0
          });
        });
        
        setTimeout(() => {
          this.socket?.disconnect();
          resolve();
        }, 1000);
      });
      
      this.socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        this.addResult('WebSocket Connection', 'fail', 'Connection error', error.message);
        resolve();
      });
    });
  }

  async testSyncHistoryEndpoint(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing Sync History Endpoint...'));
    
    try {
      const response = await this.axios.get('/sync/history');
      
      if (response.status === 200) {
        if (Array.isArray(response.data)) {
          this.addResult(
            'Sync History',
            'pass',
            `Retrieved ${response.data.length} history records`,
            response.data.slice(0, 3) // Show first 3 records
          );
        } else {
          this.addResult('Sync History', 'fail', 'Invalid response format', response.data);
        }
      } else {
        this.addResult('Sync History', 'fail', `HTTP ${response.status}`, response.data);
      }
    } catch (error) {
      this.addResult('Sync History', 'fail', 'Request failed', error.message);
    }
  }

  async testEntityStatsEndpoint(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing Entity Stats Endpoint...'));
    
    const entities = ['bi_dados_veiculos', 'bi_dados_clientes', 'os'];
    
    for (const entity of entities) {
      try {
        const response = await this.axios.get(`/stats/${entity}`);
        
        if (response.status === 200) {
          const data = response.data;
          if (typeof data.total_records === 'number') {
            this.addResult(
              `Stats for ${entity}`,
              'pass',
              `Total records: ${data.total_records}`,
              {
                lastSync: data.last_sync,
                lastSyncCount: data.last_sync_count
              }
            );
          } else {
            this.addResult(`Stats for ${entity}`, 'fail', 'Invalid response format', data);
          }
        } else {
          this.addResult(`Stats for ${entity}`, 'fail', `HTTP ${response.status}`, response.data);
        }
      } catch (error) {
        this.addResult(`Stats for ${entity}`, 'fail', 'Request failed', error.message);
      }
    }
  }

  async testWebSocketProgressEvents(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing WebSocket Progress Events...'));
    
    return new Promise(async (resolve) => {
      const socketUrl = this.apiUrl.replace('/api', '');
      const testSocket = io(socketUrl, {
        timeout: 5000,
        reconnection: false
      });
      
      const receivedEvents = {
        progress: false,
        error: false,
        complete: false
      };
      
      testSocket.on('connect', async () => {
        this.addResult('WebSocket Test Connection', 'pass', 'Connected for event testing');
        
        // Set up event listeners
        testSocket.on('sync:progress', (data) => {
          receivedEvents.progress = true;
          this.addResult('WebSocket Progress Event', 'pass', 'Received progress update', {
            entity: data.entity,
            percentage: data.progress?.percentage
          });
        });
        
        testSocket.on('sync:error', (error) => {
          receivedEvents.error = true;
          this.addResult('WebSocket Error Event', 'pass', 'Received error event', error);
        });
        
        testSocket.on('sync:complete', (status) => {
          receivedEvents.complete = true;
          this.addResult('WebSocket Complete Event', 'pass', 'Received complete event');
          
          // Clean up and resolve
          testSocket.disconnect();
          resolve();
        });
        
        // Start a sync to trigger events
        try {
          const response = await this.axios.post('/sync/start');
          if (response.status === 200) {
            console.log(chalk.yellow('   Waiting for WebSocket events (max 30s)...'));
            
            // Set a timeout to end the test
            setTimeout(() => {
              const summary = [];
              if (!receivedEvents.progress) summary.push('No progress events received');
              if (!receivedEvents.complete) summary.push('No complete event received');
              
              if (summary.length > 0) {
                this.addResult('WebSocket Events', 'fail', summary.join(', '));
              }
              
              // Stop the sync
              this.axios.post('/sync/stop').then(() => {
                testSocket.disconnect();
                resolve();
              });
            }, 30000);
          } else {
            this.addResult('WebSocket Event Test', 'fail', 'Could not start sync for testing');
            testSocket.disconnect();
            resolve();
          }
        } catch (error) {
          this.addResult('WebSocket Event Test', 'fail', 'Error starting sync', error.message);
          testSocket.disconnect();
          resolve();
        }
      });
      
      testSocket.on('connect_error', (error) => {
        this.addResult('WebSocket Test Connection', 'fail', 'Connection error', error.message);
        resolve();
      });
    });
  }

  async testErrorHandling(): Promise<void> {
    console.log(chalk.blue('\n🧪 Testing Error Handling...'));
    
    // Test invalid endpoint
    try {
      const response = await this.axios.get('/invalid-endpoint');
      if (response.status === 404) {
        this.addResult('404 Error Handling', 'pass', 'Correctly returns 404 for invalid endpoint');
      } else {
        this.addResult('404 Error Handling', 'fail', `Unexpected status: ${response.status}`);
      }
    } catch (error) {
      this.addResult('404 Error Handling', 'fail', 'Request failed', error.message);
    }
    
    // Test stopping sync when not running
    try {
      // First ensure no sync is running
      await this.axios.post('/sync/stop');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Now try to stop again
      const response = await this.axios.post('/sync/stop');
      if (response.status === 409) {
        this.addResult('Stop When Not Running', 'pass', 'Correctly returns 409 conflict');
      } else {
        this.addResult('Stop When Not Running', 'fail', `Unexpected status: ${response.status}`);
      }
    } catch (error) {
      this.addResult('Stop When Not Running', 'fail', 'Request failed', error.message);
    }
  }

  async runAllTests(): Promise<void> {
    console.log(chalk.bold.blue('\n🚀 Starting API Integration Tests\n'));
    console.log(chalk.gray(`API URL: ${this.apiUrl}`));
    console.log(chalk.gray(`Timestamp: ${new Date().toISOString()}\n`));
    
    // Check if API server is running
    try {
      await this.axios.get('/health');
    } catch (error) {
      console.log(chalk.red('\n❌ API Server is not running!'));
      console.log(chalk.yellow('Please start the API server with: npm run api:start\n'));
      return;
    }
    
    // Run all tests
    await this.testHealthEndpoint();
    await this.testSyncStatusEndpoint();
    await this.testSyncHistoryEndpoint();
    await this.testEntityStatsEndpoint();
    await this.testWebSocketConnection();
    await this.testErrorHandling();
    await this.testSyncStartStopEndpoints();
    
    // Optional: Test WebSocket events (this starts a real sync)
    const testRealSync = process.argv.includes('--with-sync');
    if (testRealSync) {
      await this.testWebSocketProgressEvents();
    } else {
      console.log(chalk.yellow('\n⚠️  Skipping WebSocket progress event test (starts real sync)'));
      console.log(chalk.gray('   Run with --with-sync to include this test\n'));
    }
    
    // Summary
    this.printSummary();
  }

  private printSummary(): void {
    console.log(chalk.bold.blue('\n📊 Test Summary\n'));
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const total = this.results.length;
    const passRate = ((passed / total) * 100).toFixed(1);
    
    console.log(`Total Tests: ${total}`);
    console.log(`${chalk.green('Passed')}: ${passed}`);
    console.log(`${chalk.red('Failed')}: ${failed}`);
    console.log(`Pass Rate: ${passRate}%`);
    
    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.message}`);
          if (r.details) {
            console.log(`    ${chalk.gray(JSON.stringify(r.details))}`);
          }
        });
    }
    
    if (passed === total) {
      console.log(chalk.bold.green('\n✅ All tests passed! API is ready for integration.\n'));
    } else {
      console.log(chalk.bold.yellow('\n⚠️  Some tests failed. Please review and fix issues before integration.\n'));
    }
  }
}

// Run tests
async function main() {
  const tester = new ApiIntegrationTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error(chalk.red('Test runner error:'), error);
  } finally {
    // Clean up
    const conn = await getConnection();
    await conn.end();
    process.exit(0);
  }
}

main();