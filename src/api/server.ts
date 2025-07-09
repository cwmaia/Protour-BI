import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import http from 'http';
import { getConnection } from '../config/database';
import { SyncOrchestrator } from '../services/sync.orchestrator';
import logger from '../utils/logger';
import { tokenManager } from '../services/tokenManager';
import { rateLimitManager } from '../services/rateLimitManager';

interface SyncProgress {
  entity: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  current: number;
  total: number;
  percentage: number;
  startTime?: Date;
  endTime?: Date;
  estimatedTimeRemaining?: number;
  error?: string;
}

interface SyncStatus {
  isRunning: boolean;
  currentEntity?: string;
  progress: SyncProgress[];
  overallProgress: number;
  startTime?: Date;
  estimatedCompletion?: Date;
  errors: Array<{ entity: string; error: string; timestamp: Date }>;
}

class SyncAPIServer {
  private app: express.Application;
  private server: http.Server;
  private io: SocketIOServer;
  private port: number;
  private syncOrchestrator: SyncOrchestrator;
  private syncStatus: SyncStatus = {
    isRunning: false,
    progress: [],
    overallProgress: 0,
    errors: []
  };

  constructor(port: number = 3050) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    this.syncOrchestrator = new SyncOrchestrator();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketIO();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      logger.info(`API Request: ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', async (req: Request, res: Response) => {
      try {
        const conn = await getConnection();
        await conn.query('SELECT 1');
        
        const tokenValid = await tokenManager.isTokenValid();
        
        res.json({
          status: 'healthy',
          services: {
            database: 'connected',
            authentication: tokenValid ? 'valid' : 'invalid',
            rateLimit: rateLimitManager.getStatus()
          },
          timestamp: new Date()
        });
      } catch (error) {
        res.status(503).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    });

    // Start sync endpoint
    this.app.post('/api/sync/start', async (req: Request, res: Response) => {
      if (this.syncStatus.isRunning) {
        return res.status(409).json({
          error: 'Sync already in progress',
          status: this.syncStatus
        });
      }

      try {
        this.syncStatus = {
          isRunning: true,
          startTime: new Date(),
          progress: [],
          overallProgress: 0,
          errors: []
        };

        // Start sync in background
        this.startSync();

        res.json({
          message: 'Sync started successfully',
          status: this.syncStatus
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to start sync',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Stop sync endpoint
    this.app.post('/api/sync/stop', async (req: Request, res: Response) => {
      if (!this.syncStatus.isRunning) {
        return res.status(409).json({
          error: 'No sync in progress'
        });
      }

      try {
        await this.syncOrchestrator.stopSync();
        this.syncStatus.isRunning = false;
        this.syncStatus.endTime = new Date();

        res.json({
          message: 'Sync stopped successfully',
          status: this.syncStatus
        });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to stop sync',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get sync status endpoint
    this.app.get('/api/sync/status', (req: Request, res: Response) => {
      res.json(this.syncStatus);
    });

    // Get sync history endpoint
    this.app.get('/api/sync/history', async (req: Request, res: Response) => {
      try {
        const conn = await getConnection();
        const [history] = await conn.query(`
          SELECT 
            entity_name,
            sync_start,
            sync_end,
            records_synced,
            status,
            error_message
          FROM sync_metadata
          ORDER BY sync_start DESC
          LIMIT 50
        `);

        res.json(history);
      } catch (error) {
        res.status(500).json({
          error: 'Failed to fetch sync history',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get entity statistics endpoint
    this.app.get('/api/stats/:entity', async (req: Request, res: Response) => {
      try {
        const { entity } = req.params;
        const conn = await getConnection();
        
        const [stats] = await conn.query(`
          SELECT 
            COUNT(*) as total_records,
            MAX(sync_metadata.sync_end) as last_sync,
            sync_metadata.records_synced as last_sync_count
          FROM sync_metadata
          WHERE entity_name = ?
          ORDER BY sync_end DESC
          LIMIT 1
        `, [entity]);

        res.json(stats[0] || { total_records: 0, last_sync: null, last_sync_count: 0 });
      } catch (error) {
        res.status(500).json({
          error: 'Failed to fetch entity statistics',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Error handling middleware
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('API Error:', err);
      res.status(500).json({
        error: 'Internal server error',
        details: err.message
      });
    });
  }

  private setupSocketIO(): void {
    this.io.on('connection', (socket) => {
      logger.info('Client connected to WebSocket');
      
      // Send current status on connection
      socket.emit('sync:status', this.syncStatus);

      socket.on('disconnect', () => {
        logger.info('Client disconnected from WebSocket');
      });
    });
  }

  private async startSync(): Promise<void> {
    try {
      // Initialize token and rate limit managers
      await tokenManager.initialize();
      await rateLimitManager.initialize();

      const entities = [
        'bi_dados_clientes',
        'bi_dados_veiculos',
        'clientes',
        'veiculos',
        'contratos',
        'formas_pagamento',
        'os'
      ];

      for (const entity of entities) {
        if (!this.syncStatus.isRunning) break;

        const progress: SyncProgress = {
          entity,
          status: 'running',
          current: 0,
          total: 0,
          percentage: 0,
          startTime: new Date()
        };

        this.syncStatus.currentEntity = entity;
        this.syncStatus.progress.push(progress);
        
        // Emit progress update
        this.io.emit('sync:progress', {
          entity,
          progress
        });

        try {
          // Set up progress callback
          const updateProgress = (current: number, total: number) => {
            progress.current = current;
            progress.total = total;
            progress.percentage = total > 0 ? Math.round((current / total) * 100) : 0;
            
            // Calculate estimated time remaining
            if (progress.startTime && current > 0 && total > 0) {
              const elapsed = Date.now() - progress.startTime.getTime();
              const rate = current / elapsed;
              const remaining = total - current;
              progress.estimatedTimeRemaining = remaining / rate;
            }

            // Update overall progress
            this.updateOverallProgress();

            // Emit progress update
            this.io.emit('sync:progress', {
              entity,
              progress
            });
          };

          // Run sync with progress callback
          await this.syncOrchestrator.syncEntity(entity, updateProgress);

          progress.status = 'completed';
          progress.endTime = new Date();
          progress.percentage = 100;

        } catch (error) {
          progress.status = 'error';
          progress.error = error instanceof Error ? error.message : 'Unknown error';
          progress.endTime = new Date();
          
          this.syncStatus.errors.push({
            entity,
            error: progress.error,
            timestamp: new Date()
          });

          // Emit error
          this.io.emit('sync:error', {
            entity,
            error: progress.error
          });
        }
      }

      this.syncStatus.isRunning = false;
      this.syncStatus.currentEntity = undefined;
      this.io.emit('sync:complete', this.syncStatus);

    } catch (error) {
      logger.error('Sync failed:', error);
      this.syncStatus.isRunning = false;
      this.io.emit('sync:error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private updateOverallProgress(): void {
    const completed = this.syncStatus.progress.filter(p => p.status === 'completed').length;
    const total = this.syncStatus.progress.length;
    this.syncStatus.overallProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Calculate estimated completion time
    if (this.syncStatus.startTime && this.syncStatus.overallProgress > 0 && this.syncStatus.overallProgress < 100) {
      const elapsed = Date.now() - this.syncStatus.startTime.getTime();
      const rate = this.syncStatus.overallProgress / elapsed;
      const remaining = 100 - this.syncStatus.overallProgress;
      const estimatedRemaining = remaining / rate;
      this.syncStatus.estimatedCompletion = new Date(Date.now() + estimatedRemaining);
    }
  }

  async start(): Promise<void> {
    try {
      // Test database connection
      await getConnection();
      logger.info('API Server: Database connection established');

      this.server.listen(this.port, () => {
        logger.info(`Sync API Server running on port ${this.port}`);
        logger.info(`WebSocket server ready for real-time updates`);
      });
    } catch (error) {
      logger.error('Failed to start API server:', error);
      throw error;
    }
  }

  stop(): void {
    this.server.close(() => {
      logger.info('API Server stopped');
    });
  }
}

export default SyncAPIServer;