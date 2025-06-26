import { tokenManager } from '../services/tokenManager';
import { rateLimitManager } from '../services/rateLimitManager';
import { getConnection } from '../config/database';
import logger from '../utils/logger';

/**
 * Initialize script with shared token and rate limit managers
 * This ensures all sync scripts use the same authentication token and rate limiting
 */
export async function initializeScript(): Promise<void> {
  try {
    // Ensure database connection
    await getConnection();
    
    // Initialize token manager
    logger.info('Initializing shared token manager for script');
    await tokenManager.initialize();
    
    // Initialize rate limit manager
    logger.info('Initializing shared rate limit manager for script');
    await rateLimitManager.initialize();
    
    logger.info('Script initialization complete');
  } catch (error) {
    logger.error('Failed to initialize script:', error);
    throw error;
  }
}