import { tokenManager } from '../services/tokenManager';
import { getConnection, closeConnection } from '../config/database';
import chalk from 'chalk';
import { RowDataPacket } from 'mysql2';

async function testTokenManager() {
  console.log(chalk.bold.cyan('\n=== Testing Token Manager ===\n'));

  try {
    // Initialize database connection
    await getConnection();
    
    // Initialize token manager
    console.log(chalk.yellow('1. Initializing token manager...'));
    await tokenManager.initialize();
    console.log(chalk.green('   ✓ Token manager initialized'));

    // Get token status
    console.log(chalk.yellow('\n2. Checking token status...'));
    const status = await tokenManager.getTokenStatus();
    console.log(`   Token valid: ${status.isValid ? chalk.green('Yes') : chalk.red('No')}`);
    if (status.expiresAt) {
      console.log(`   Expires at: ${status.expiresAt.toISOString()}`);
      console.log(`   Hours until expiry: ${status.hoursUntilExpiry?.toFixed(2)}`);
    }

    // Get current token
    console.log(chalk.yellow('\n3. Getting current token...'));
    const token = await tokenManager.getToken();
    console.log(`   Token obtained: ${chalk.green(token.substring(0, 20) + '...')}`);

    // Check database
    console.log(chalk.yellow('\n4. Checking database storage...'));
    const pool = await getConnection();
    const [rows] = await pool.execute<RowDataPacket[]>('SELECT * FROM auth_tokens');
    console.log(`   Tokens in database: ${rows.length}`);

    console.log(chalk.bold.green('\n✓ Token manager is working correctly!\n'));

  } catch (error) {
    console.error(chalk.red('\n✗ Token manager test failed:'), error);
  } finally {
    await closeConnection();
  }
}

if (require.main === module) {
  testTokenManager();
}