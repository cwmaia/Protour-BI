import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
  connectTimeout: number;
  timezone: string;
}

const dbConfig: DatabaseConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'locavia_bi',
  connectionLimit: 10,
  connectTimeout: 60000,
  timezone: '+00:00'
};

let pool: mysql.Pool | null = null;

export async function getConnection(): Promise<mysql.Pool> {
  if (!pool) {
    try {
      pool = mysql.createPool(dbConfig);
      
      // Test connection
      const connection = await pool.getConnection();
      await connection.ping();
      connection.release();
      
      logger.info('Database connection pool created successfully');
    } catch (error) {
      logger.error('Failed to create database connection pool:', error);
      throw error;
    }
  }
  
  return pool;
}

export async function closeConnection(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database connection pool closed');
  }
}

export async function executeQuery<T>(sql: string, params?: any[]): Promise<T[]> {
  const connection = await getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  } catch (error) {
    logger.error('Query execution failed:', { sql, params, error });
    throw error;
  }
}

export async function executeTransaction(queries: Array<{ sql: string; params?: any[] }>): Promise<void> {
  const pool = await getConnection();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    for (const query of queries) {
      await connection.execute(query.sql, query.params);
    }
    
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    logger.error('Transaction failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}