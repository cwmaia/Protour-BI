import { getConnection } from '../config/database';
import { ApiClient } from './api.client';
import logger from '../utils/logger';
import { RowDataPacket } from 'mysql2';

interface TokenInfo {
  token: string;
  expiresAt: Date;
  isValid: boolean;
}

export class TokenManager {
  private static instance: TokenManager;
  private apiClient: ApiClient | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    // Don't initialize ApiClient here to avoid circular dependency
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Get ApiClient instance lazily to avoid circular dependency
   */
  private getApiClient(): ApiClient {
    if (!this.apiClient) {
      // Import dynamically to avoid circular dependency issues
      const { ApiClient } = require('./api.client');
      this.apiClient = ApiClient.getInstance();
    }
    return this.apiClient as ApiClient;
  }

  /**
   * Initialize token manager and start auto-refresh
   */
  async initialize(): Promise<void> {
    try {
      // Check if we have a valid token in the database
      const existingToken = await this.getStoredToken();
      
      if (existingToken && existingToken.isValid) {
        logger.info('Using existing valid token from database');
        this.getApiClient().setAuthToken(existingToken.token);
      } else {
        logger.info('Obtaining new authentication token');
        await this.refreshToken();
      }

      // Start auto-refresh (every 20 hours to be safe)
      this.startAutoRefresh();
    } catch (error) {
      logger.error('Failed to initialize token manager:', error);
      throw error;
    }
  }

  /**
   * Get current valid token
   */
  async getToken(): Promise<string> {
    const tokenInfo = await this.getStoredToken();
    
    if (!tokenInfo || !tokenInfo.isValid) {
      await this.refreshToken();
      const newTokenInfo = await this.getStoredToken();
      if (!newTokenInfo) {
        throw new Error('Failed to obtain valid token');
      }
      return newTokenInfo.token;
    }
    
    return tokenInfo.token;
  }

  /**
   * Force refresh token
   */
  async refreshToken(): Promise<void> {
    try {
      logger.info('Refreshing authentication token');
      
      // Authenticate with API
      await this.getApiClient().authenticate();
      const token = this.getApiClient().getAuthToken();
      
      if (!token) {
        throw new Error('No token received from authentication');
      }

      // Store token in database
      await this.storeToken(token);
      
      logger.info('Token refreshed successfully');
    } catch (error) {
      logger.error('Failed to refresh token:', error);
      throw error;
    }
  }

  /**
   * Get stored token from database
   */
  async getStoredToken(): Promise<TokenInfo | null> {
    try {
      const pool = await getConnection();
      
      // Create token table if it doesn't exist
      await pool.execute(`
        CREATE TABLE IF NOT EXISTS auth_tokens (
          id INT PRIMARY KEY DEFAULT 1,
          token TEXT NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT single_row CHECK (id = 1)
        )
      `);

      const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT token, expires_at FROM auth_tokens WHERE id = 1'
      );

      if (rows.length === 0) {
        return null;
      }

      const expiresAt = new Date(rows[0].expires_at);
      const now = new Date();
      
      // Check if token is still valid (with 1 hour buffer)
      const bufferTime = 60 * 60 * 1000; // 1 hour in milliseconds
      const isValid = expiresAt.getTime() - bufferTime > now.getTime();

      return {
        token: rows[0].token,
        expiresAt,
        isValid
      };
    } catch (error) {
      logger.error('Failed to get stored token:', error);
      return null;
    }
  }

  /**
   * Store token in database
   */
  private async storeToken(token: string): Promise<void> {
    try {
      const pool = await getConnection();
      
      // Token expires in 24 hours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await pool.execute(
        `INSERT INTO auth_tokens (id, token, expires_at) 
         VALUES (1, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         token = VALUES(token), 
         expires_at = VALUES(expires_at),
         updated_at = CURRENT_TIMESTAMP`,
        [token, expiresAt]
      );

      logger.info(`Token stored, expires at ${expiresAt.toISOString()}`);
    } catch (error) {
      logger.error('Failed to store token:', error);
      throw error;
    }
  }

  /**
   * Start auto-refresh interval
   */
  private startAutoRefresh(): void {
    // Clear existing interval if any
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
    }

    // Refresh every 20 hours (4 hours before expiry)
    const refreshInterval = 20 * 60 * 60 * 1000; // 20 hours in milliseconds
    
    this.tokenRefreshInterval = setInterval(async () => {
      try {
        logger.info('Auto-refreshing token');
        await this.refreshToken();
      } catch (error) {
        logger.error('Auto-refresh failed:', error);
      }
    }, refreshInterval);

    logger.info('Token auto-refresh scheduled for every 20 hours');
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.tokenRefreshInterval) {
      clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  /**
   * Get token status for monitoring
   */
  async getTokenStatus(): Promise<{
    isValid: boolean;
    expiresAt: Date | null;
    hoursUntilExpiry: number | null;
  }> {
    const tokenInfo = await this.getStoredToken();
    
    if (!tokenInfo) {
      return {
        isValid: false,
        expiresAt: null,
        hoursUntilExpiry: null
      };
    }

    const now = new Date();
    const hoursUntilExpiry = (tokenInfo.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    return {
      isValid: tokenInfo.isValid,
      expiresAt: tokenInfo.expiresAt,
      hoursUntilExpiry: Math.max(0, hoursUntilExpiry)
    };
  }
}

// Export singleton instance
export const tokenManager = TokenManager.getInstance();