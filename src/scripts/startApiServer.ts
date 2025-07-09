import dotenv from 'dotenv';
import SyncAPIServer from '../api/server';
import { getConnection } from '../config/database';
import { tokenManager } from '../services/tokenManager';
import { rateLimitManager } from '../services/rateLimitManager';
import logger from '../utils/logger';

dotenv.config();

async function startServer() {
  try {
    logger.info('Starting Sync API Server...');
    
    // Test database connection
    await getConnection();
    logger.info('Database connection established');
    
    // Initialize token manager
    await tokenManager.initialize();
    logger.info('Token manager initialized');
    
    // Initialize rate limit manager
    await rateLimitManager.initialize();
    logger.info('Rate limit manager initialized');
    
    // Start API server
    const port = parseInt(process.env.API_PORT || '3050', 10);
    const server = new SyncAPIServer(port);
    await server.start();
    
    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      server.stop();
      tokenManager.stopAutoRefresh();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start API server:', error);
    process.exit(1);
  }
}

startServer();