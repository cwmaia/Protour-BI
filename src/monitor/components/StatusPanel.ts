import blessed from 'blessed';
import { SyncStatus } from '../types';

export class StatusPanel {
  private box: blessed.Widgets.BoxElement;
  private statusList: blessed.Widgets.ListElement;

  constructor(parent: blessed.Widgets.BoxElement) {
    this.box = blessed.box({
      parent,
      label: ' Sync Status ',
      top: 3,
      left: 0,
      width: '30%',
      height: '40%',
      border: {
        type: 'line'
      },
      style: {
        bg: 'black',
        border: {
          fg: 'cyan'
        },
        label: {
          fg: 'cyan',
          bold: true
        }
      }
    });

    this.statusList = blessed.list({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-2',
      items: [],
      style: {
        selected: {
          bg: 'blue',
          fg: 'white'
        },
        item: {
          fg: 'white'
        }
      },
      interactive: false
    });
  }

  update(statuses: SyncStatus[]): void {
    const items = statuses.map(status => {
      const icon = this.getStatusIcon(status.status);
      const entity = status.entity.padEnd(15);
      const statusText = status.status.padEnd(8);
      
      // Add sync count for completed entities
      let extra = '';
      if (status.recordsSynced > 0) {
        extra = ` (${status.recordsSynced} records)`;
      }
      
      // Show last sync time for non-running entities
      if (status.status !== 'running' && status.lastSyncTime) {
        const ago = this.getTimeAgo(status.lastSyncTime);
        extra += ` ${ago}`;
      }
      
      return `${icon} ${entity} ${statusText}${extra}`;
    });

    this.statusList.setItems(items);
    if (this.box.screen) {
      this.box.screen.render();
    }
  }

  private getStatusIcon(status: SyncStatus['status']): string {
    switch (status) {
      case 'running': return '🟢';
      case 'stopped': return '🔴';
      case 'waiting': return '🟡';
      case 'error': return '❌';
      default: return '⚪';
    }
  }

  focus(): void {
    this.statusList.focus();
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}