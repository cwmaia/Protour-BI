import axios, { AxiosInstance, AxiosError } from 'axios';
import { apiConfig } from '../config/api';
import { ApiResponse, ApiError, AuthRequest, AuthResponse } from '../types/api.types';
import logger from '../utils/logger';
import { tokenManager } from './tokenManager';
import { rateLimitManager } from './rateLimitManager';

export class ApiClient {
  private static instance: ApiClient | null = null;
  private axiosInstance: AxiosInstance;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 100; // Minimum 100ms between requests
  private useSharedToken: boolean = true; // Use shared token manager by default

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: apiConfig.baseUrl,
      timeout: apiConfig.requestTimeout,
      headers: {
        'accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Check rate limit before making request
        if (config.url && !config.url.includes('/auth/access-token')) {
          await rateLimitManager.waitIfNeeded(config.url);
        }
        
        // Only add token for non-auth requests
        if (!config.url?.includes('/auth/access-token')) {
          const token = await this.getValidToken();
          config.headers['X-API-Key'] = token;
        }
        logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      async (error: AxiosError<ApiError>) => {
        const originalRequest = error.config;
        
        // Handle rate limiting
        if (error.response?.status === 429 && originalRequest) {
          const endpoint = originalRequest.url || '';
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
          
          await rateLimitManager.markRateLimited(endpoint, waitTime);
          logger.warn(`Rate limited on ${endpoint}, waiting ${waitTime}ms`);
        }
        
        if (error.response?.status === 401 && originalRequest && !originalRequest.url?.includes('/auth/access-token')) {
          // Avoid infinite loop - mark request as retried
          if ((originalRequest as any)._retry) {
            throw error;
          }
          (originalRequest as any)._retry = true;
          
          logger.info('Token expired, refreshing...');
          this.token = null;
          this.tokenExpiry = null;
          
          try {
            const token = await this.getValidToken();
            originalRequest.headers['X-API-Key'] = token;
            return this.axiosInstance(originalRequest);
          } catch (authError) {
            logger.error('Token refresh failed:', authError);
            throw authError;
          }
        }

        logger.error(`API Error: ${error.response?.status} ${error.config?.url}`, {
          data: error.response?.data,
          message: error.message
        });
        
        throw error;
      }
    );
  }


  private async getValidToken(): Promise<string> {
    // Use shared token manager if enabled
    if (this.useSharedToken) {
      try {
        return await tokenManager.getToken();
      } catch (error) {
        logger.error('Failed to get token from token manager:', error);
        // Fall back to instance authentication
        this.useSharedToken = false;
      }
    }

    // Instance-based token management (fallback)
    const now = new Date();
    logger.debug(`Token check - Current time: ${now.toISOString()}, Token expiry: ${this.tokenExpiry?.toISOString()}, Has token: ${!!this.token}`);
    
    if (!this.token || !this.tokenExpiry || now >= this.tokenExpiry) {
      logger.info('Token needs refresh - triggering authentication');
      return await this.authenticateInternal();
    }
    return this.token;
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.get<ApiResponse<T>>(endpoint, { params });
      
      // Handle null responses
      if (response.data === null) {
        logger.warn(`Endpoint ${endpoint} returned null response`);
        // Return empty results structure for endpoints that expect pagination
        return { results: [] } as unknown as T;
      }
      
      return response.data.data;
    });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.post<ApiResponse<T>>(endpoint, data);
      return response.data.data;
    });
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.patch<ApiResponse<T>>(endpoint, data);
      return response.data.data;
    });
  }

  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.executeWithRetry(async () => {
      const response = await this.axiosInstance.put<ApiResponse<T>>(endpoint, data);
      return response.data.data;
    });
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      // Rate limiting: ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        const waitTime = this.minRequestInterval - timeSinceLastRequest;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      this.lastRequestTime = Date.now();
      return await operation();
    } catch (error) {
      // Handle rate limiting (429) with exponential backoff
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : apiConfig.retryDelay * Math.pow(2, attempt);
        
        logger.warn(`Rate limited, waiting ${delay}ms before retry (attempt ${attempt}/${apiConfig.retryAttempts})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Increase minimum interval to avoid future rate limiting
        this.minRequestInterval = Math.min(this.minRequestInterval * 1.5, 1000);
        
        if (attempt < apiConfig.retryAttempts) {
          return this.executeWithRetry(operation, attempt + 1);
        }
      }
      
      // Handle other errors with regular retry logic
      if (attempt < apiConfig.retryAttempts) {
        const delay = apiConfig.retryDelay * Math.pow(2, attempt - 1);
        logger.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${apiConfig.retryAttempts})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.executeWithRetry(operation, attempt + 1);
      }
      
      throw error;
    }
  }

  // Public methods for token manager
  async authenticate(): Promise<void> {
    await this.authenticateInternal();
  }

  getAuthToken(): string | null {
    return this.token;
  }

  setAuthToken(token: string): void {
    this.token = token;
    // Set expiry to 24 hours from now
    this.tokenExpiry = new Date(Date.now() + (24 * 60 * 60 * 1000));
  }

  private async authenticateInternal(): Promise<string> {
    try {
      const authData: AuthRequest = {
        cnpj: apiConfig.credentials.cnpj,
        username: apiConfig.credentials.username,
        password: apiConfig.credentials.password
      };

      const response = await this.axiosInstance.post<ApiResponse<AuthResponse>>(
        '/auth/access-token',
        authData
      );

      this.token = response.data.data.token;
      // Set token expiry to configured hours before actual expiry
      this.tokenExpiry = new Date(Date.now() + (apiConfig.tokenRefreshHours * 60 * 60 * 1000));
      
      logger.info(`Authentication successful, token expires at: ${this.tokenExpiry.toISOString()}`);
      return this.token;
    } catch (error) {
      logger.error('Authentication failed:', error);
      throw new Error('Failed to authenticate with Locavia API');
    }
  }

  async *paginate<T>(
    endpoint: string,
    pageSize: number = apiConfig.pagination.defaultPageSize,
    additionalParams?: Record<string, any>
  ): AsyncGenerator<T[], void, unknown> {
    // Check if this endpoint supports pagination
    // BI endpoints (/dados*) and OS endpoint support pagination with 'pagina' and 'linhas' parameters
    const supportsPagination = endpoint.startsWith('/dados') || endpoint === '/os';
    
    if (supportsPagination) {
      // BI endpoints support pagination with 'pagina' and 'linhas' parameters
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          const params = {
            ...additionalParams,
            pagina: page,
            linhas: Math.min(pageSize, apiConfig.pagination.maxPageSize)
          };

          const response = await this.get<{ results: T[] }>(endpoint, params);
          
          // Handle null or invalid responses
          if (!response || !response.results) {
            logger.warn(`Endpoint ${endpoint} returned invalid response structure`);
            hasMore = false;
            yield [];
          } else if (response.results.length > 0) {
            yield response.results;
            page++;
            
            // If we got less than requested, we've reached the end
            if (response.results.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        } catch (error) {
          logger.error(`Pagination error at page ${page} for endpoint ${endpoint}:`, error);
          throw error;
        }
      }
    } else {
      // Regular endpoints don't support pagination - fetch all data at once
      try {
        // Don't send any pagination parameters for regular endpoints
        const response = await this.get<{ results: T[] }>(endpoint, additionalParams);
        
        // Handle null or invalid responses
        if (!response || !response.results) {
          logger.warn(`Endpoint ${endpoint} returned invalid response structure`);
          yield [];
        } else if (response.results.length > 0) {
          // For non-paginated endpoints, we need to handle large datasets
          // Split into chunks to match expected batch processing
          const totalRecords = response.results.length;
          logger.info(`Endpoint ${endpoint} returned ${totalRecords} records (non-paginated)`);
          
          for (let i = 0; i < totalRecords; i += pageSize) {
            const batch = response.results.slice(i, i + pageSize);
            yield batch;
          }
        }
      } catch (error) {
        // Handle 404 errors for endpoints that don't exist
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          logger.warn(`Endpoint ${endpoint} not found (404). Returning empty results.`);
          // Return empty array for non-existent endpoints
          yield [];
        } else {
          logger.error(`Error fetching data from endpoint ${endpoint}:`, error);
          throw error;
        }
      }
    }
  }
}