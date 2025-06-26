export interface SyncStatus {
  entity: string;
  status: 'running' | 'stopped' | 'waiting' | 'error';
  progress: number;
  recordsTotal: number;
  recordsSynced: number;
  lastSyncTime?: Date;
  currentBatch?: number;
  totalBatches?: number;
  pid?: number;
  error?: string;
}

export interface SyncStatistics {
  totalOsRecords: number;
  syncedOsRecords: number;
  totalExpenses: number;
  expectedMonthlyExpenses: number;
  lastRateLimit?: Date;
  apiCallsToday: number;
  activeSyncs: number;
  tokenValid?: boolean;
  tokenExpiresIn?: number;
}

export interface ActivityLogEntry {
  timestamp: Date;
  entity: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ProcessInfo {
  entity: string;
  pid: number;
  startTime: Date;
  status: 'running' | 'completed' | 'failed';
}

export type MonitorCommand = 'start-all' | 'stop-all' | 'sync-os' | 'sync-bi' | 'refresh' | 'logs' | 'export' | 'quit';