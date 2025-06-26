import blessed from 'blessed';
import { SyncStatus } from '../types';

export class ErrorSummaryPanel {
  private box: blessed.Widgets.BoxElement;
  private content: blessed.Widgets.TextElement;

  constructor(parent: blessed.Widgets.BoxElement) {
    this.box = blessed.box({
      parent,
      label: ' Error Summary ',
      top: '40%',
      left: '50%',
      width: '50%',
      height: '20%',
      border: {
        type: 'line'
      },
      style: {
        bg: 'black',
        border: {
          fg: 'red'
        },
        label: {
          fg: 'red',
          bold: true
        }
      }
    });

    this.content = blessed.text({
      parent: this.box,
      top: 0,
      left: 1,
      width: '100%-2',
      height: '100%-2',
      content: '',
      style: {
        fg: 'white'
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' ',
        track: {
          bg: 'gray'
        }
      }
    });
  }

  update(statuses: SyncStatus[]): void {
    const errors = statuses.filter(s => s.status === 'error' && s.error);
    
    if (errors.length === 0) {
      this.content.setContent('{green-fg}✓ No errors detected{/}');
      this.box.style.border.fg = 'green';
      this.box.style.label.fg = 'green';
    } else {
      // Group errors by type
      const errorGroups: Record<string, string[]> = {};
      
      errors.forEach(status => {
        const errorType = this.categorizeError(status.error || '');
        if (!errorGroups[errorType]) {
          errorGroups[errorType] = [];
        }
        errorGroups[errorType].push(status.entity);
      });

      // Format error summary
      const lines: string[] = [];
      
      Object.entries(errorGroups).forEach(([type, entities]) => {
        const color = this.getErrorColor(type);
        lines.push(`${color}${type}:{/} ${entities.join(', ')}`);
      });

      // Add action hints
      if (errorGroups['Authentication Failed']) {
        lines.push('');
        lines.push('{yellow-fg}→ Token may have expired. Check auth status{/}');
      }
      
      if (errorGroups['Rate Limited']) {
        lines.push('');
        lines.push('{yellow-fg}→ API rate limit hit. Reduce sync frequency{/}');
      }

      this.content.setContent(lines.join('\n'));
      this.box.style.border.fg = 'red';
      this.box.style.label.fg = 'red';
    }

    if (this.box.screen) {
      this.box.screen.render();
    }
  }

  private categorizeError(error: string): string {
    if (error.includes('authenticate')) return 'Authentication Failed';
    if (error.includes('429')) return 'Rate Limited';
    if (error.includes('null')) return 'Null Response';
    if (error.includes('column')) return 'Database Error';
    return 'Other Error';
  }

  private getErrorColor(type: string): string {
    switch (type) {
      case 'Authentication Failed': return '{red-fg}';
      case 'Rate Limited': return '{yellow-fg}';
      case 'Database Error': return '{magenta-fg}';
      default: return '{red-fg}';
    }
  }
}