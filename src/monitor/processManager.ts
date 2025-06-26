import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import logger from '../utils/logger';
import { ProcessInfo } from './types';

export class ProcessManager extends EventEmitter {
  private processes: Map<string, ChildProcess> = new Map();
  private processInfo: Map<string, ProcessInfo> = new Map();

  async startSync(entity: string): Promise<number | null> {
    // Don't start if already running
    if (this.processes.has(entity)) {
      logger.warn(`Sync for ${entity} is already running`);
      return null;
    }

    try {
      const scriptPath = path.join(__dirname, '..', 'scripts', 'syncEntity.ts');
      const child = spawn('npx', ['ts-node', scriptPath, entity], {
        detached: false,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { 
          ...process.env,
          // Ensure child processes use production settings
          NODE_ENV: 'production',
          // Pass token manager flag
          USE_SHARED_TOKEN: 'true'
        }
      });

      if (!child.pid) {
        throw new Error('Failed to start process');
      }

      this.processes.set(entity, child);
      this.processInfo.set(entity, {
        entity,
        pid: child.pid,
        startTime: new Date(),
        status: 'running'
      });

      // Handle process output
      child.stdout?.on('data', (data) => {
        const message = data.toString().trim();
        // Filter out verbose logs
        if (!message.includes('[32minfo[39m') && message.length > 0) {
          this.emit('log', { entity, level: 'info', message: this.cleanMessage(message) });
        }
      });

      child.stderr?.on('data', (data) => {
        const message = data.toString().trim();
        if (message.length > 0) {
          this.emit('log', { entity, level: 'error', message: this.cleanMessage(message) });
        }
      });

      // Handle process exit
      child.on('exit', (code) => {
        const info = this.processInfo.get(entity);
        if (info) {
          info.status = code === 0 ? 'completed' : 'failed';
        }
        this.processes.delete(entity);
        this.emit('process-exit', { entity, code, info });
      });

      child.on('error', (error) => {
        logger.error(`Process error for ${entity}:`, error);
        this.emit('process-error', { entity, error });
      });

      logger.info(`Started sync process for ${entity} with PID ${child.pid}`);
      this.emit('process-start', { entity, pid: child.pid });
      
      return child.pid;
    } catch (error) {
      logger.error(`Failed to start sync for ${entity}:`, error);
      this.emit('process-error', { entity, error });
      return null;
    }
  }

  async stopSync(entity: string): Promise<boolean> {
    const child = this.processes.get(entity);
    if (!child) {
      logger.warn(`No running process found for ${entity}`);
      return false;
    }

    try {
      child.kill('SIGTERM');
      
      // Give process time to cleanup
      setTimeout(() => {
        if (child.killed === false) {
          child.kill('SIGKILL');
        }
      }, 5000);

      logger.info(`Stopped sync process for ${entity}`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop sync for ${entity}:`, error);
      return false;
    }
  }

  async startAll(): Promise<void> {
    const entities = [
      'dados_veiculos',
      'dados_clientes',
      'os',
      'veiculos',
      'contratos',
      'formas_pagamento'
    ];

    // Start syncs with delay to avoid overwhelming the API
    for (const entity of entities) {
      await this.startSync(entity);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  async stopAll(): Promise<void> {
    const runningEntities = Array.from(this.processes.keys());
    
    for (const entity of runningEntities) {
      await this.stopSync(entity);
    }
  }

  getRunningProcesses(): ProcessInfo[] {
    return Array.from(this.processInfo.values()).filter(p => p.status === 'running');
  }

  getProcessInfo(entity: string): ProcessInfo | undefined {
    return this.processInfo.get(entity);
  }

  isRunning(entity: string): boolean {
    return this.processes.has(entity);
  }

  cleanup(): void {
    // Kill all processes on cleanup
    this.processes.forEach((child, entity) => {
      try {
        child.kill('SIGKILL');
      } catch (error) {
        logger.error(`Failed to kill process for ${entity}:`, error);
      }
    });
    
    this.processes.clear();
    this.processInfo.clear();
  }

  private cleanMessage(message: string): string {
    // Remove ANSI color codes and clean up messages
    return message
      .replace(/\x1b\[[0-9;]*m/g, '') // Remove ANSI codes
      .replace(/\[3[0-9]m/g, '') // Remove color codes
      .replace(/\[39m/g, '') // Remove reset codes
      .replace(/^(info|error|warn):\s*/i, '') // Remove log level prefixes
      .trim();
  }
}