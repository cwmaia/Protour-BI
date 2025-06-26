import blessed from 'blessed';
import { ActivityLogEntry } from '../types';

export class ActivityLog {
  private box: blessed.Widgets.BoxElement;
  private log: any; // blessed.log returns an extended box element
  private maxEntries: number = 100;

  constructor(parent: blessed.Widgets.BoxElement) {
    this.box = blessed.box({
      parent,
      label: ' Activity Log ',
      top: '60%',
      left: 0,
      width: '100%',
      height: '35%',
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

    this.log = blessed.log({
      parent: this.box,
      top: 0,
      left: 0,
      width: '100%-2',
      height: '100%-2',
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        },
        style: {
          inverse: true
        }
      },
      style: {
        fg: 'white',
        scrollbar: {
          bg: 'blue'
        }
      }
    });
  }

  addEntry(entry: ActivityLogEntry): void {
    const timestamp = entry.timestamp.toTimeString().split(' ')[0];
    const levelColor = this.getLevelColor(entry.level);
    const entityTag = `[${entry.entity.toUpperCase()}]`.padEnd(20);
    
    const line = `${timestamp} ${levelColor}${entityTag}{/} ${entry.message}`;
    this.log.log(line);
    
    // Keep only last maxEntries
    if (this.log.getLines().length > this.maxEntries) {
      this.log.setContent(this.log.getLines().slice(-this.maxEntries).join('\n'));
    }
    
    if (this.box.screen) {
      this.box.screen.render();
    }
  }

  addEntries(entries: ActivityLogEntry[]): void {
    entries.forEach(entry => this.addEntry(entry));
  }

  private getLevelColor(level: ActivityLogEntry['level']): string {
    switch (level) {
      case 'error': return '{red-fg}';
      case 'warning': return '{yellow-fg}';
      case 'info': return '{green-fg}';
      default: return '';
    }
  }

  clear(): void {
    this.log.setContent('');
    if (this.box.screen) {
      this.box.screen.render();
    }
  }

  focus(): void {
    this.log.focus();
  }
}