import { getConnection } from '../config/database';
import { SyncStatus, SyncStatistics } from './types';
import { RowDataPacket } from 'mysql2';

export async function getSyncStatuses(): Promise<SyncStatus[]> {
  const pool = await getConnection();
  
  const [rows] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      entity_name,
      sync_status,
      records_synced,
      last_sync_at,
      error_message
    FROM sync_metadata
    ORDER BY entity_name
  `);
  
  return rows.map(row => ({
    entity: row.entity_name,
    status: row.sync_status === 'running' ? 'running' : 
            row.sync_status === 'failed' ? 'error' : 
            row.sync_status === 'completed' ? 'stopped' : 'waiting',
    progress: 0,
    recordsTotal: 0,
    recordsSynced: row.records_synced || 0,
    lastSyncTime: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
    error: row.error_message
  }));
}

export async function getSyncStatistics(): Promise<SyncStatistics> {
  const pool = await getConnection();
  
  // Get OS statistics
  const [osStats] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      COUNT(*) as total_os,
      SUM(CASE WHEN quantidade_itens > 0 THEN 1 ELSE 0 END) as os_with_items
    FROM os
  `);
  
  // Get expense statistics
  const [expenseStats] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      COALESCE(SUM(valor_total_item), 0) as total_expenses
    FROM os_itens
  `);
  
  // Get today's API call count from audit log
  const [apiCalls] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      COUNT(*) as api_calls_today
    FROM sync_audit_log
    WHERE DATE(started_at) = CURDATE()
  `);
  
  // Get active syncs
  const [activeSyncs] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      COUNT(*) as active_syncs
    FROM sync_metadata
    WHERE sync_status = 'running'
  `);
  
  return {
    totalOsRecords: osStats[0].total_os || 0,
    syncedOsRecords: osStats[0].os_with_items || 0,
    totalExpenses: parseFloat(expenseStats[0].total_expenses) || 0,
    expectedMonthlyExpenses: 200000,
    apiCallsToday: apiCalls[0].api_calls_today || 0,
    activeSyncs: activeSyncs[0].active_syncs || 0
  };
}

export async function getRecentActivity(limit: number = 10): Promise<any[]> {
  const pool = await getConnection();
  
  const [rows] = await pool.execute<RowDataPacket[]>(`
    SELECT 
      entity_name,
      operation,
      status,
      error_message,
      started_at,
      completed_at
    FROM sync_audit_log
    ORDER BY started_at DESC
    LIMIT ${limit}
  `);
  
  return rows.map(row => ({
    timestamp: new Date(row.started_at),
    entity: row.entity_name,
    level: row.status === 'failed' ? 'error' : 
           row.status === 'started' ? 'warning' : 'info',
    message: row.error_message || 
             `${row.operation} ${row.status} ${row.completed_at ? `in ${Math.round((new Date(row.completed_at).getTime() - new Date(row.started_at).getTime()) / 1000)}s` : ''}`
  }));
}

export async function getEntityProgress(entity: string): Promise<{ current: number; total: number }> {
  const pool = await getConnection();
  
  // Special handling for OS entity to get real-time progress
  if (entity === 'os') {
    const [current] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) as count FROM os');
    const currentCount = current[0].count || 0;
    
    // Estimate total based on API (this would be better tracked during sync)
    return { current: currentCount, total: currentCount > 0 ? Math.max(currentCount, 1000) : 1000 };
  }
  
  // For BI entities, check actual counts
  const tableMap: Record<string, string> = {
    'dados_veiculos': 'bi_dados_veiculos',
    'dados_clientes': 'bi_dados_clientes',
    'veiculos': 'veiculos',
    'contratos': 'contratos',
    'formas_pagamento': 'formas_pagamento'
  };
  
  const tableName = tableMap[entity];
  if (!tableName) {
    return { current: 0, total: 0 };
  }
  
  const [current] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) as count FROM ${tableName}`);
  return { current: current[0].count || 0, total: current[0].count || 0 };
}