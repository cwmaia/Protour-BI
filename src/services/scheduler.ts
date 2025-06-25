import * as cron from 'node-cron';
import { SyncOrchestrator } from './sync.orchestrator';
import logger from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

export class SyncScheduler {
  private orchestrator: SyncOrchestrator;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private syncIntervalMinutes: number;

  constructor() {
    this.orchestrator = new SyncOrchestrator();
    this.syncIntervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || '60');
  }

  start(): void {
    logger.info('Starting sync scheduler');

    // Schedule main sync job
    const cronExpression = this.getCronExpression(this.syncIntervalMinutes);
    const mainTask = cron.schedule(cronExpression, async () => {
      logger.info('Running scheduled sync');
      try {
        await this.orchestrator.syncAll();
      } catch (error) {
        logger.error('Scheduled sync failed:', error);
      }
    });

    this.tasks.set('main_sync', mainTask);

    // Schedule health check every 5 minutes
    const healthTask = cron.schedule('*/5 * * * *', async () => {
      try {
        const status = await this.orchestrator.getSyncStatus();
        const failed = status.filter(s => s.sync_status === 'failed');
        
        if (failed.length > 0) {
          logger.warn(`${failed.length} entities in failed state:`, 
            failed.map(f => f.entity_name).join(', '));
        }
      } catch (error) {
        logger.error('Health check failed:', error);
      }
    });

    this.tasks.set('health_check', healthTask);

    logger.info(`Sync scheduled to run every ${this.syncIntervalMinutes} minutes`);
  }

  stop(): void {
    logger.info('Stopping sync scheduler');
    
    for (const [name, task] of this.tasks) {
      task.stop();
      logger.info(`Stopped task: ${name}`);
    }
    
    this.tasks.clear();
  }

  async runOnce(): Promise<void> {
    logger.info('Running one-time sync');
    await this.orchestrator.syncAll();
  }

  async runEntity(entityName: string): Promise<void> {
    logger.info(`Running sync for entity: ${entityName}`);
    await this.orchestrator.syncEntity(entityName);
  }

  private getCronExpression(minutes: number): string {
    if (minutes < 60) {
      return `*/${minutes} * * * *`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `0 */${hours} * * *`;
    }
  }
}