import 'dotenv/config';
import { spawn } from 'child_process';
import chalk from 'chalk';

async function testSyncFlow() {
  console.log(chalk.bold.cyan('\n=== Testing Sync Flow with Fixes ===\n'));
  
  // Set environment variables for silent logging
  process.env.LOG_SILENT = 'true';
  process.env.LOG_FILE_ONLY = 'true';
  process.env.NODE_ENV = 'production';
  
  console.log(chalk.yellow('1. Testing single entity sync (formas_pagamento)...'));
  
  const child = spawn('npx', ['ts-node', 'src/scripts/syncEntity.ts', 'formas_pagamento'], {
    env: {
      ...process.env,
      USE_SHARED_TOKEN: 'true'
    },
    stdio: ['inherit', 'pipe', 'pipe']
  });

  let output = '';
  let errorOutput = '';
  let hasTokenError = false;
  let hasCircularError = false;
  
  child.stdout?.on('data', (data) => {
    const msg = data.toString();
    output += msg;
    
    // Check for successful progress
    if (msg.includes('Starting sync') || msg.includes('records fetched') || msg.includes('completed')) {
      process.stdout.write(chalk.green('  ✓ ') + msg.trim() + '\n');
    }
  });
  
  child.stderr?.on('data', (data) => {
    const msg = data.toString();
    errorOutput += msg;
    
    // Check for specific errors
    if (msg.includes('Cannot read properties of undefined')) {
      hasCircularError = true;
    }
    if (msg.includes('TokenManager') || msg.includes('token')) {
      hasTokenError = true;
    }
  });

  // Wait for process to complete
  const exitCode = await new Promise<number>((resolve) => {
    child.on('exit', (code) => resolve(code || 0));
  });
  
  console.log('\n' + chalk.yellow('2. Analyzing results...'));
  
  if (hasCircularError) {
    console.log(chalk.red('  ✗ Circular dependency error still present!'));
  } else {
    console.log(chalk.green('  ✓ No circular dependency errors'));
  }
  
  if (hasTokenError) {
    console.log(chalk.red('  ✗ Token manager errors detected'));
  } else {
    console.log(chalk.green('  ✓ Token management working correctly'));
  }
  
  if (exitCode === 0) {
    console.log(chalk.green('  ✓ Sync completed successfully (exit code 0)'));
  } else {
    console.log(chalk.red(`  ✗ Sync failed with exit code ${exitCode}`));
  }
  
  if (errorOutput.length > 0) {
    console.log(chalk.yellow('\n3. Error output (if any):'));
    console.log(chalk.red(errorOutput.substring(0, 500)));
  }
  
  // Final verdict
  console.log('\n' + chalk.bold(exitCode === 0 && !hasCircularError && !hasTokenError 
    ? chalk.green('✅ All critical issues fixed! Sync flow working correctly.')
    : chalk.red('❌ Issues remain. Check error output above.')));
  
  process.exit(exitCode);
}

testSyncFlow().catch(console.error);