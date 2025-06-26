import blessed from 'blessed';
import { SyncStatistics } from '../types';

export class StatisticsPanel {
  private box: blessed.Widgets.BoxElement;
  private content: blessed.Widgets.TextElement;

  constructor(parent: blessed.Widgets.BoxElement) {
    this.box = blessed.box({
      parent,
      label: ' Statistics ',
      top: '43%',
      left: 0,
      width: '50%',
      height: '20%',
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

    this.content = blessed.text({
      parent: this.box,
      top: 0,
      left: 1,
      width: '100%-2',
      height: '100%-2',
      content: '',
      style: {
        fg: 'white'
      }
    });
  }

  update(stats: SyncStatistics): void {
    const expensePercentage = (stats.totalExpenses / stats.expectedMonthlyExpenses) * 100;
    const expenseColor = expensePercentage < 50 ? '{red-fg}' : 
                        expensePercentage < 80 ? '{yellow-fg}' : '{green-fg}';

    const tokenColor = stats.tokenValid ? '{green-fg}' : '{red-fg}';
    const tokenStatus = stats.tokenValid ? 
      `Valid (${stats.tokenExpiresIn?.toFixed(1)}h)` : 'Invalid';
    
    const content = [
      `Total OS: {bold}${stats.totalOsRecords.toLocaleString()}{/bold} | `,
      `Synced: {bold}${stats.syncedOsRecords.toLocaleString()}{/bold} | `,
      `Remaining: {bold}${(stats.totalOsRecords - stats.syncedOsRecords).toLocaleString()}{/bold}`,
      '',
      `Monthly Expenses: ${expenseColor}R$ ${stats.totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}{/} / `,
      `~R$ ${stats.expectedMonthlyExpenses.toLocaleString('pt-BR')} expected`,
      '',
      `Token: ${tokenColor}${tokenStatus}{/} | `,
      stats.lastRateLimit ? `Last Rate Limit: {yellow-fg}${this.getTimeAgo(stats.lastRateLimit)}{/} | ` : '',
      `API Calls: {bold}${stats.apiCallsToday}{/bold} | `,
      `Active: {bold}${stats.activeSyncs}{/bold}`
    ].filter(Boolean).join('');

    this.content.setContent(content);
    if (this.box.screen) {
      this.box.screen.render();
    }
  }

  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}