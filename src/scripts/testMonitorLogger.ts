import 'dotenv/config';
import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

async function testMonitorLogger() {
  console.log('Testing monitor with logger suppression...\n');
  
  // Check if log files exist before
  const logsDir = join(process.cwd(), 'logs');
  const errorLogBefore = existsSync(join(logsDir, 'error.log')) 
    ? readFileSync(join(logsDir, 'error.log'), 'utf-8').length 
    : 0;
  const combinedLogBefore = existsSync(join(logsDir, 'combined.log')) 
    ? readFileSync(join(logsDir, 'combined.log'), 'utf-8').length 
    : 0;
  
  console.log('Starting monitor with LOG_SILENT=true LOG_FILE_ONLY=true...');
  
  // Start the monitor with the environment variables
  const monitor = spawn('npx', ['ts-node', 'src/monitor/syncMonitor.ts'], {
    env: {
      ...process.env,
      LOG_SILENT: 'true',
      LOG_FILE_ONLY: 'true',
      NODE_ENV: 'production'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  let errorOutput = '';
  
  monitor.stdout?.on('data', (data) => {
    output += data.toString();
  });
  
  monitor.stderr?.on('data', (data) => {
    errorOutput += data.toString();
  });

  // Let it run for 3 seconds
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Send 'q' to quit
  if (monitor.stdin) {
    monitor.stdin.write('q');
  } else {
    monitor.kill('SIGTERM');
  }
  
  // Wait for process to exit
  await new Promise<void>((resolve) => {
    monitor.on('exit', () => resolve());
  });
  
  console.log('\nMonitor exited.');
  
  // Check log files after
  const errorLogAfter = existsSync(join(logsDir, 'error.log')) 
    ? readFileSync(join(logsDir, 'error.log'), 'utf-8').length 
    : 0;
  const combinedLogAfter = existsSync(join(logsDir, 'combined.log')) 
    ? readFileSync(join(logsDir, 'combined.log'), 'utf-8').length 
    : 0;
  
  console.log('\nResults:');
  console.log(`✓ Stdout output length: ${output.length} chars`);
  console.log(`✓ Stderr output length: ${errorOutput.length} chars`);
  console.log(`✓ Error log growth: ${errorLogAfter - errorLogBefore} bytes`);
  console.log(`✓ Combined log growth: ${combinedLogAfter - combinedLogBefore} bytes`);
  
  if (output.includes('info:') || output.includes('[32m') || errorOutput.includes('error:')) {
    console.log('\n❌ Logger output detected in console! Fix needed.');
    if (output.includes('info:')) console.log('  - Info messages found in stdout');
    if (output.includes('[32m')) console.log('  - ANSI color codes found in stdout');
    if (errorOutput.includes('error:')) console.log('  - Error messages found in stderr');
  } else {
    console.log('\n✅ No logger output in console - UI should be clean!');
  }
  
  process.exit(0);
}

testMonitorLogger().catch(console.error);