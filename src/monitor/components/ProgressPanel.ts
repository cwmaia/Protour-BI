import blessed from 'blessed';
import { SyncStatus } from '../types';

export class ProgressPanel {
  private box: blessed.Widgets.BoxElement;
  private gauges: Map<string, any> = new Map();
  private layout: any;

  constructor(parent: blessed.Widgets.BoxElement) {
    this.box = blessed.box({
      parent,
      label: ' Progress ',
      top: 0,
      left: '30%',
      width: '70%',
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

    // Create a grid layout for progress bars
    this.layout = blessed.layout({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-2',
      layout: 'grid'
    });
  }

  update(statuses: SyncStatus[]): void {
    // Clear existing gauges
    this.layout.children.forEach((child: any) => child.destroy());
    this.gauges.clear();

    // Create progress bars for active syncs
    const activeSyncs = statuses.filter(s => s.status === 'running' || s.progress > 0);
    
    activeSyncs.forEach((status) => {
      const row = blessed.box({
        parent: this.layout,
        height: 3,
        width: '100%'
      });

      // Entity label
      blessed.text({
        parent: row,
        content: status.entity,
        top: 0,
        left: 0,
        width: '30%',
        style: {
          fg: 'white'
        }
      });

      // Progress bar
      const progressBar = blessed.progressbar({
        parent: row,
        orientation: 'horizontal',
        top: 0,
        left: '30%',
        width: '50%',
        height: 1,
        style: {
          bar: {
            bg: status.status === 'error' ? 'red' : 'green'
          }
        },
        filled: status.progress,
        ch: '█'
      });

      // Progress text
      const progressText = blessed.text({
        parent: row,
        content: `${status.progress}% ${this.getStatusEmoji(status.status)}`,
        top: 0,
        left: '82%',
        width: '18%',
        style: {
          fg: 'yellow'
        }
      });

      // Details text
      const details = blessed.text({
        parent: row,
        content: `${status.recordsSynced}/${status.recordsTotal || '?'} records`,
        top: 1,
        left: '30%',
        style: {
          fg: 'gray'
        }
      });

      this.gauges.set(status.entity, { progressBar, progressText, details });
    });

    // If no active syncs, show message
    if (activeSyncs.length === 0) {
      blessed.text({
        parent: this.layout,
        content: 'No active syncs',
        top: 'center',
        left: 'center',
        style: {
          fg: 'gray'
        }
      });
    }

    if (this.box.screen) {
      this.box.screen.render();
    }
  }

  private getStatusEmoji(status: SyncStatus['status']): string {
    switch (status) {
      case 'running': return '🔄';
      case 'stopped': return '✓';
      case 'waiting': return '⏸️';
      case 'error': return '❌';
      default: return '';
    }
  }
}