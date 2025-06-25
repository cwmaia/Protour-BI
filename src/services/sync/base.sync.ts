import { ApiClient } from '../api.client';
import { getConnection } from '../../config/database';
import { RowDataPacket } from 'mysql2';

export interface SyncResult {
  entity: string;
  recordsSynced: number;
  success: boolean;
  error?: string;
  duration: number;
}

export abstract class BaseSyncService {
  protected apiClient: ApiClient;
  protected entityName: string;
  protected batchSize: number = 100;

  constructor(entityName: string) {
    this.apiClient = ApiClient.getInstance();
    this.entityName = entityName;
  }

  abstract sync(): Promise<SyncResult>;

  protected async updateSyncMetadata(
    status: 'running' | 'completed' | 'failed',
    recordsSynced: number = 0,
    errorMessage?: string
  ): Promise<void> {
    const pool = await getConnection();
    await pool.execute(
      `UPDATE sync_metadata 
       SET sync_status = ?, 
           last_sync_at = CURRENT_TIMESTAMP,
           records_synced = ?,
           error_message = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE entity_name = ?`,
      [status, recordsSynced, errorMessage || null, this.entityName]
    );
  }

  protected async logSyncAudit(
    operation: string,
    recordCount: number,
    status: string,
    startedAt: Date,
    completedAt: Date | null = null,
    errorMessage?: string
  ): Promise<void> {
    const pool = await getConnection();
    await pool.execute(
      `INSERT INTO sync_audit_log 
       (entity_name, operation, record_count, status, error_message, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [this.entityName, operation, recordCount, status, errorMessage || null, startedAt, completedAt]
    );
  }

  protected async getLastSyncDate(): Promise<Date | null> {
    const pool = await getConnection();
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT last_sync_at FROM sync_metadata WHERE entity_name = ?',
      [this.entityName]
    );
    
    if (rows.length > 0 && rows[0].last_sync_at) {
      return new Date(rows[0].last_sync_at);
    }
    
    return null;
  }

  protected async executeBatchInsert(
    tableName: string,
    columns: string[],
    records: any[],
    updateOnDuplicate: boolean = true
  ): Promise<number> {
    if (records.length === 0) return 0;

    const pool = await getConnection();
    const connection = await pool.getConnection();
    let totalInserted = 0;

    try {
      await connection.beginTransaction();

      // Process in batches
      for (let i = 0; i < records.length; i += this.batchSize) {
        const batch = records.slice(i, i + this.batchSize);
        
        const placeholders = batch.map(() => 
          `(${columns.map(() => '?').join(', ')})`
        ).join(', ');

        const values = batch.flatMap(record => 
          columns.map(col => record[col] ?? null)
        );

        let sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders}`;
        
        if (updateOnDuplicate) {
          const updateClauses = columns
            .filter(col => col !== 'sync_date' && !col.includes('PRIMARY'))
            .map(col => `${col} = VALUES(${col})`)
            .join(', ');
          
          sql += ` ON DUPLICATE KEY UPDATE ${updateClauses}, sync_date = CURRENT_TIMESTAMP`;
        }

        const [result] = await connection.execute(sql, values);
        totalInserted += (result as any).affectedRows || 0;
      }

      await connection.commit();
      return totalInserted;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  protected mapApiDataToDb(apiData: any, mapping: Record<string, string>): any {
    const dbData: any = {};
    
    for (const [apiField, dbField] of Object.entries(mapping)) {
      if (apiData.hasOwnProperty(apiField)) {
        dbData[dbField] = apiData[apiField];
      }
    }
    
    return dbData;
  }
}