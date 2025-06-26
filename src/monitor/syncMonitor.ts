import blessed from 'blessed';
import { format } from 'date-fns';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { ProcessManager } from './processManager';
import { StatusPanel } from './components/StatusPanel';
import { ProgressPanel } from './components/ProgressPanel';
import { StatisticsPanel } from './components/StatisticsPanel';
import { ActivityLog } from './components/ActivityLog';
import { ErrorSummaryPanel } from './components/ErrorSummaryPanel';
import { getSyncStatuses, getSyncStatistics, getRecentActivity, getEntityProgress } from './queries';
import { SyncStatus } from './types';
import logger from '../utils/logger';
import { closeConnection } from '../config/database';

export class SyncMonitor {
  private screen: blessed.Widgets.Screen;
  private mainContainer: blessed.Widgets.BoxElement;
  private statusPanel: StatusPanel;
  private progressPanel: ProgressPanel;
  private statisticsPanel: StatisticsPanel;
  private activityLog: ActivityLog;
  private errorPanel: ErrorSummaryPanel;
  private processManager: ProcessManager;
  private updateInterval?: NodeJS.Timeout;
  private statuses: SyncStatus[] = [];

  constructor() {
    // Initialize screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Locavia Sync Monitor',
      fullUnicode: true,
      autoPadding: false,
      warnings: true,
      forceUnicode: true
    });

    // Clear the terminal completely
    this.screen.alloc();
    
    // Create main container to fix background bleed
    this.mainContainer = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      style: {
        bg: 'black',
        fg: 'white'
      },
      ch: ' ' // Fill with spaces to ensure full coverage
    });

    // Initialize process manager
    this.processManager = new ProcessManager();

    // Create title bar
    blessed.box({
      parent: this.mainContainer,
      top: 0,
      left: 0,
      width: '100%',
      height: 3,
      content: '{center}Locavia Sync Monitor - Real-time Sync Status{/center}',
      style: {
        bg: 'blue',
        fg: 'white',
        bold: true
      },
      tags: true
    });

    // Create UI components with mainContainer as parent (adjusted for title bar)
    this.statusPanel = new StatusPanel(this.mainContainer);
    this.progressPanel = new ProgressPanel(this.mainContainer);
    this.statisticsPanel = new StatisticsPanel(this.mainContainer);
    this.activityLog = new ActivityLog(this.mainContainer);
    this.errorPanel = new ErrorSummaryPanel(this.mainContainer);

    // Create command bar
    blessed.box({
      parent: this.mainContainer,
      bottom: 0,
      left: 0,
      width: '100%',
      height: 3,
      border: {
        type: 'line'
      },
      style: {
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      content: ' Commands: [1]Start All [2]Stop All [3]OS Sync [4]BI Sync [5]Refresh [6]Logs [7]Export [q]Quit '
    });

    // Set up event handlers
    this.setupEventHandlers();
    this.setupProcessManagerEvents();
  }

  private setupEventHandlers(): void {
    // Keyboard shortcuts
    this.screen.key(['1'], () => this.handleStartAll());
    this.screen.key(['2'], () => this.handleStopAll());
    this.screen.key(['3'], () => this.handleSyncOS());
    this.screen.key(['4'], () => this.handleSyncBI());
    this.screen.key(['5'], () => this.refresh());
    this.screen.key(['6'], () => this.showDetailedLogs());
    this.screen.key(['7'], () => this.exportReport());
    this.screen.key(['q', 'C-c'], () => this.quit());
    
    // Navigation
    this.screen.key(['tab'], () => this.focusNext());
    this.screen.key(['S-tab'], () => this.focusPrevious());
  }

  private setupProcessManagerEvents(): void {
    this.processManager.on('log', (data) => {
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: data.entity,
        level: data.level,
        message: data.message
      });
    });

    this.processManager.on('process-start', (data) => {
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: data.entity,
        level: 'info',
        message: `Sync started (PID: ${data.pid})`
      });
      this.refresh();
    });

    this.processManager.on('process-exit', (data) => {
      const message = data.code === 0 ? 'Sync completed successfully' : `Sync failed with code ${data.code}`;
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: data.entity,
        level: data.code === 0 ? 'info' : 'error',
        message
      });
      this.refresh();
    });

    this.processManager.on('process-error', (data) => {
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: data.entity,
        level: 'error',
        message: `Process error: ${data.error.message}`
      });
    });
  }

  private async handleStartAll(): Promise<void> {
    this.activityLog.addEntry({
      timestamp: new Date(),
      entity: 'system',
      level: 'info',
      message: 'Starting all sync processes...'
    });
    await this.processManager.startAll();
  }

  private async handleStopAll(): Promise<void> {
    this.activityLog.addEntry({
      timestamp: new Date(),
      entity: 'system',
      level: 'warning',
      message: 'Stopping all sync processes...'
    });
    await this.processManager.stopAll();
  }

  private async handleSyncOS(): Promise<void> {
    if (this.processManager.isRunning('os')) {
      await this.processManager.stopSync('os');
    } else {
      await this.processManager.startSync('os');
    }
  }

  private async handleSyncBI(): Promise<void> {
    const biEntities = ['dados_veiculos', 'dados_clientes'];
    for (const entity of biEntities) {
      if (!this.processManager.isRunning(entity)) {
        await this.processManager.startSync(entity);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  private showDetailedLogs(): void {
    // Create a popup with detailed logs
    const logPopup = blessed.box({
      parent: this.screen,
      label: ' Detailed Logs ',
      top: 'center',
      left: 'center',
      width: '90%',
      height: '90%',
      border: {
        type: 'line'
      },
      style: {
        border: {
          fg: 'cyan'
        }
      }
    });

    blessed.log({
      parent: logPopup,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-3',
      scrollable: true,
      alwaysScroll: true
    });

    blessed.text({
      parent: logPopup,
      bottom: 0,
      left: 'center',
      content: 'Press ESC to close',
      style: {
        fg: 'yellow'
      }
    });

    logPopup.focus();
    logPopup.key(['escape'], () => {
      logPopup.destroy();
      this.screen.render();
    });

    this.screen.render();
  }

  private async exportReport(): Promise<void> {
    const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
    const filename = `sync_report_${timestamp}.json`;
    const reportsDir = join(process.cwd(), 'reports');
    const filepath = join(reportsDir, filename);
    
    try {
      // Ensure reports directory exists
      const { mkdirSync, existsSync } = await import('fs');
      if (!existsSync(reportsDir)) {
        mkdirSync(reportsDir, { recursive: true });
      }

      const stats = await getSyncStatistics();
      const statuses = await getSyncStatuses();
      const activity = await getRecentActivity(50);

      const report = {
        timestamp: new Date(),
        statistics: {
          ...stats,
          expensePercentage: (stats.totalExpenses / stats.expectedMonthlyExpenses) * 100
        },
        syncStatuses: statuses,
        recentActivity: activity,
        runningProcesses: this.processManager.getRunningProcesses(),
        summary: {
          totalEntities: statuses.length,
          runningEntities: statuses.filter(s => s.status === 'running').length,
          errorEntities: statuses.filter(s => s.status === 'error').length,
          completedEntities: statuses.filter(s => s.status === 'stopped').length
        }
      };

      // Write report to file
      writeFileSync(filepath, JSON.stringify(report, null, 2));
      logger.info(`Report exported to ${filepath}`);
      
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: 'system',
        level: 'info',
        message: `Report exported to ${filename}`
      });
    } catch (error) {
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: 'system',
        level: 'error',
        message: `Failed to export report: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private focusNext(): void {
    // Simple focus rotation between panels
    this.screen.focusNext();
  }

  private focusPrevious(): void {
    this.screen.focusPrevious();
  }

  async start(): Promise<void> {
    // Initial load
    await this.refresh();

    // Load recent activity
    const recentActivity = await getRecentActivity(20);
    recentActivity.reverse().forEach(entry => this.activityLog.addEntry(entry));

    // Start update interval
    this.updateInterval = setInterval(() => this.refresh(), 2000);

    // Render screen
    this.screen.render();
  }

  private async refresh(): Promise<void> {
    try {
      // Get current sync statuses
      const dbStatuses = await getSyncStatuses();
      
      // Merge with process manager status
      this.statuses = dbStatuses.map(status => {
        const isRunning = this.processManager.isRunning(status.entity);
        const processInfo = this.processManager.getProcessInfo(status.entity);
        
        return {
          ...status,
          status: isRunning ? 'running' : status.status,
          pid: processInfo?.pid
        };
      });

      // Get progress for running syncs
      for (const status of this.statuses) {
        if (status.status === 'running') {
          const progress = await getEntityProgress(status.entity);
          status.recordsTotal = progress.total;
          status.recordsSynced = progress.current;
          status.progress = progress.total > 0 
            ? Math.round((progress.current / progress.total) * 100)
            : 0;
        }
      }

      // Update UI components
      this.statusPanel.update(this.statuses);
      this.progressPanel.update(this.statuses);
      this.errorPanel.update(this.statuses);

      // Get and update statistics
      const stats = await getSyncStatistics();
      this.statisticsPanel.update(stats);

      this.screen.render();
    } catch (error) {
      logger.error('Failed to refresh monitor:', error);
      this.activityLog.addEntry({
        timestamp: new Date(),
        entity: 'system',
        level: 'error',
        message: `Refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  private async quit(): Promise<void> {
    // Cleanup
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Stop all processes
    await this.processManager.stopAll();
    this.processManager.cleanup();

    // Close database connection
    await closeConnection();

    // Exit
    process.exit(0);
  }
}

// Main entry point
async function main() {
  try {
    const monitor = new SyncMonitor();
    await monitor.start();
  } catch (error) {
    logger.error('Failed to start sync monitor:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}