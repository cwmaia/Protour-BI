import { getConnection } from '../config/database';
import logger from '../utils/logger';
import { RowDataPacket } from 'mysql2';

interface RateLimitInfo {
  endpoint: string;
  lastRequestTime: Date;
  requestCount: number;
  isLimited: boolean;
  resetTime?: Date;
}

export class RateLimitManager {
  private static instance: RateLimitManager;
  private minRequestInterval: number = 100; // Base minimum interval between requests
  private rateLimitWindow: number = 60000; // 1 minute window
  private maxRequestsPerWindow: number = 100; // Max requests per minute
  
  private constructor() {}

  static getInstance(): RateLimitManager {
    if (!RateLimitManager.instance) {
      RateLimitManager.instance = new RateLimitManager();
    }
    return RateLimitManager.instance;
  }

  /**
   * Initialize rate limit tracking table
   */
  async initialize(): Promise<void> {
    try {
      const pool = await getConnection();
      
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS rate_limit_tracker (
          endpoint VARCHAR(255) PRIMARY KEY,
          last_request_time TIMESTAMP NULL,
          request_count INT DEFAULT 0,
          is_limited BOOLEAN DEFAULT FALSE,
          reset_time TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      logger.info('Rate limit manager initialized');
    } catch (error) {
      logger.error('Failed to initialize rate limit manager:', error);
      throw error;
    }
  }

  /**
   * Check if request can proceed and update tracking
   */
  async canMakeRequest(endpoint: string): Promise<{ allowed: boolean; waitTime?: number }> {
    const pool = await getConnection();
    
    try {
      // Get current rate limit info
      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM rate_limit_tracker WHERE endpoint = ?',
        [endpoint]
      );
      
      const now = new Date();
      let rateLimitInfo: RateLimitInfo;
      
      if (rows.length === 0) {
        // First request for this endpoint
        rateLimitInfo = {
          endpoint,
          lastRequestTime: now,
          requestCount: 0,
          isLimited: false
        };
      } else {
        rateLimitInfo = {
          endpoint: rows[0].endpoint,
          lastRequestTime: new Date(rows[0].last_request_time),
          requestCount: rows[0].request_count,
          isLimited: rows[0].is_limited,
          resetTime: rows[0].reset_time ? new Date(rows[0].reset_time) : undefined
        };
      }
      
      // Check if we're currently rate limited
      if (rateLimitInfo.isLimited && rateLimitInfo.resetTime) {
        if (now < rateLimitInfo.resetTime) {
          const waitTime = rateLimitInfo.resetTime.getTime() - now.getTime();
          return { allowed: false, waitTime };
        } else {
          // Rate limit has expired, reset
          rateLimitInfo.isLimited = false;
          rateLimitInfo.requestCount = 0;
        }
      }
      
      // Check minimum interval between requests
      const timeSinceLastRequest = now.getTime() - rateLimitInfo.lastRequestTime.getTime();
      if (timeSinceLastRequest < this.minRequestInterval) {
        return { allowed: false, waitTime: this.minRequestInterval - timeSinceLastRequest };
      }
      
      // Check rate limit window
      if (timeSinceLastRequest > this.rateLimitWindow) {
        // Reset counter for new window
        rateLimitInfo.requestCount = 1;
      } else {
        rateLimitInfo.requestCount++;
        
        if (rateLimitInfo.requestCount > this.maxRequestsPerWindow) {
          // Rate limit exceeded
          return { allowed: false, waitTime: this.rateLimitWindow - timeSinceLastRequest };
        }
      }
      
      // Update tracking
      await this.updateTracking(endpoint, now, rateLimitInfo.requestCount, false);
      
      return { allowed: true };
      
    } catch (error) {
      logger.error('Rate limit check failed:', error);
      // Allow request on error to avoid blocking
      return { allowed: true };
    }
  }

  /**
   * Mark endpoint as rate limited (e.g., after receiving 429 response)
   */
  async markRateLimited(endpoint: string, waitTimeMs: number = 60000): Promise<void> {
    const pool = await getConnection();
    const now = new Date();
    const resetTime = new Date(now.getTime() + waitTimeMs);
    
    try {
      await pool.execute(
        `INSERT INTO rate_limit_tracker (endpoint, last_request_time, is_limited, reset_time) 
         VALUES (?, ?, TRUE, ?) 
         ON DUPLICATE KEY UPDATE 
         last_request_time = VALUES(last_request_time),
         is_limited = TRUE,
         reset_time = VALUES(reset_time),
         updated_at = CURRENT_TIMESTAMP`,
        [endpoint, now, resetTime]
      );
      
      logger.warn(`Endpoint ${endpoint} marked as rate limited until ${resetTime.toISOString()}`);
      
      // Increase minimum interval for this endpoint
      this.adjustMinInterval(waitTimeMs);
      
    } catch (error) {
      logger.error('Failed to mark endpoint as rate limited:', error);
    }
  }

  /**
   * Update request tracking
   */
  private async updateTracking(
    endpoint: string, 
    requestTime: Date, 
    requestCount: number, 
    isLimited: boolean,
    resetTime?: Date
  ): Promise<void> {
    const pool = await getConnection();
    
    await pool.execute(
      `INSERT INTO rate_limit_tracker (endpoint, last_request_time, request_count, is_limited, reset_time) 
       VALUES (?, ?, ?, ?, ?) 
       ON DUPLICATE KEY UPDATE 
       last_request_time = VALUES(last_request_time),
       request_count = VALUES(request_count),
       is_limited = VALUES(is_limited),
       reset_time = VALUES(reset_time),
       updated_at = CURRENT_TIMESTAMP`,
      [endpoint, requestTime, requestCount, isLimited, resetTime]
    );
  }

  /**
   * Adjust minimum interval based on rate limit responses
   */
  private adjustMinInterval(waitTimeMs: number): void {
    // Increase interval by 10% of wait time, max 1000ms
    const increase = Math.min(waitTimeMs * 0.1, 1000);
    this.minRequestInterval = Math.min(this.minRequestInterval + increase, 1000);
    logger.info(`Adjusted minimum request interval to ${this.minRequestInterval}ms`);
  }

  /**
   * Get rate limit status for monitoring
   */
  async getRateLimitStatus(): Promise<RateLimitInfo[]> {
    const pool = await getConnection();
    
    const [rows] = await pool.execute<RowDataPacket[]>(`
      SELECT * FROM rate_limit_tracker 
      WHERE is_limited = TRUE OR request_count > 50
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    
    return rows.map(row => ({
      endpoint: row.endpoint,
      lastRequestTime: new Date(row.last_request_time),
      requestCount: row.request_count,
      isLimited: row.is_limited,
      resetTime: row.reset_time ? new Date(row.reset_time) : undefined
    }));
  }

  /**
   * Wait if necessary before making request
   */
  async waitIfNeeded(endpoint: string): Promise<void> {
    const { allowed, waitTime } = await this.canMakeRequest(endpoint);
    
    if (!allowed && waitTime) {
      logger.info(`Rate limit: waiting ${waitTime}ms before request to ${endpoint}`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Export singleton instance
export const rateLimitManager = RateLimitManager.getInstance();