import { SyncScheduler } from './services/scheduler';
import { getConnection, closeConnection } from './config/database';
import logger from './utils/logger';
import dotenv from 'dotenv';

dotenv.config();

class Application {
  private scheduler: SyncScheduler;

  constructor() {
    this.scheduler = new SyncScheduler();
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting Locavia Sync Service');
      
      // Test database connection
      await getConnection();
      logger.info('Database connection established');
      
      // Run initial sync if environment variable is set
      if (process.env.RUN_INITIAL_SYNC === 'true') {
        logger.info('Running initial sync...');
        await this.scheduler.runOnce();
      }
      
      // Start scheduler
      this.scheduler.start();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      logger.info('Application started successfully');
    } catch (error) {
      logger.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      
      try {
        this.scheduler.stop();
        await closeConnection();
        logger.info('Application shut down successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });
  }
}

// Start application
const app = new Application();
app.start().catch((error) => {
  logger.error('Application startup failed:', error);
  process.exit(1);
});