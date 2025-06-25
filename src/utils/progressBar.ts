import chalk from 'chalk';

export class ProgressBar {
  private total: number;
  private current: number;
  private barLength: number;
  private startTime: number;
  private label: string;

  constructor(total: number, label: string = '', barLength: number = 30) {
    this.total = total;
    this.current = 0;
    this.barLength = barLength;
    this.startTime = Date.now();
    this.label = label;
  }

  update(current: number): void {
    this.current = current;
    this.render();
  }

  increment(amount: number = 1): void {
    this.current += amount;
    this.render();
  }

  private render(): void {
    const percentage = Math.min((this.current / this.total) * 100, 100);
    const filledLength = Math.round((this.barLength * percentage) / 100);
    const emptyLength = this.barLength - filledLength;

    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    
    const elapsed = Date.now() - this.startTime;
    const rate = this.current / (elapsed / 1000);
    const eta = this.current > 0 ? (this.total - this.current) / rate : 0;

    const progressBar = `${this.label} [${chalk.green(filledBar)}${chalk.gray(emptyBar)}] ${percentage.toFixed(1)}% | ${this.current}/${this.total} | ${rate.toFixed(1)}/s | ETA: ${this.formatTime(eta)}`;
    
    process.stdout.write('\r' + progressBar);
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }

  complete(): void {
    this.current = this.total;
    this.render();
    console.log(''); // New line after completion
  }
}

export class MultiProgressBar {
  private bars: Map<string, { total: number; current: number; status: string }> = new Map();
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  addBar(id: string, total: number): void {
    this.bars.set(id, { total, current: 0, status: 'pending' });
  }

  update(id: string, current: number, status: string = 'running'): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.current = current;
      bar.status = status;
      this.render();
    }
  }

  complete(id: string): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.current = bar.total;
      bar.status = 'completed';
      this.render();
    }
  }

  error(id: string, message: string): void {
    const bar = this.bars.get(id);
    if (bar) {
      bar.status = `failed: ${message}`;
      this.render();
    }
  }

  private render(): void {
    console.clear();
    console.log(chalk.bold.cyan('\n=== Locavia Data Sync Progress ===\n'));

    const elapsed = (Date.now() - this.startTime) / 1000;
    let totalRecords = 0;
    let syncedRecords = 0;

    this.bars.forEach((bar, id) => {
      totalRecords += bar.total;
      syncedRecords += bar.current;

      const percentage = bar.total > 0 ? Math.min((bar.current / bar.total) * 100, 100) : 0;
      const width = 30;
      const filledLength = Math.max(0, Math.min(width, Math.round((width * percentage) / 100)));
      const emptyLength = Math.max(0, width - filledLength);

      const filledBar = '█'.repeat(filledLength);
      const emptyBar = '░'.repeat(emptyLength);

      let statusColor = chalk.yellow;
      let statusIcon = '⏳';
      
      if (bar.status === 'completed') {
        statusColor = chalk.green;
        statusIcon = '✓';
      } else if (bar.status.startsWith('failed')) {
        statusColor = chalk.red;
        statusIcon = '✗';
      } else if (bar.status === 'running') {
        statusColor = chalk.blue;
        statusIcon = '⚡';
      }

      const entityName = id.padEnd(20);
      const progress = `[${chalk.green(filledBar)}${chalk.gray(emptyBar)}]`;
      const stats = `${percentage.toFixed(1).padStart(5)}% | ${bar.current.toString().padStart(6)}/${bar.total.toString().padEnd(6)}`;
      const status = statusColor(`${statusIcon} ${bar.status}`);

      console.log(`${entityName} ${progress} ${stats} ${status}`);
    });

    console.log(chalk.gray('\n' + '─'.repeat(70)));
    const overallPercentage = totalRecords > 0 ? (syncedRecords / totalRecords) * 100 : 0;
    console.log(chalk.bold(`Overall Progress: ${overallPercentage.toFixed(1)}% | ${syncedRecords}/${totalRecords} records | Elapsed: ${this.formatTime(elapsed)}`));
  }

  private formatTime(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }
}