import { ApiClient } from '../../services/api.client';
import axios from 'axios';

jest.mock('axios');

describe('OS Endpoint Pagination', () => {
  let apiClient: ApiClient;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (ApiClient as any).instance = null;
    
    // Mock axios.create to return a mock axios instance
    const mockAxiosInstance = {
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      },
      get: jest.fn(),
      post: jest.fn()
    };
    
    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);
    
    // Mock successful auth response
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: {
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        expires_in: 86400
      }
    });
    
    // Store reference to mocked instance for test assertions
    (mockedAxios as any).mockInstance = mockAxiosInstance;
    
    apiClient = ApiClient.getInstance();
  });

  describe('paginate method with OS endpoint', () => {
    it('should treat /os endpoint as paginated', async () => {
      const mockInstance = (mockedAxios as any).mockInstance;
      
      // Mock paginated responses
      mockInstance.get
        .mockResolvedValueOnce({
          data: {
            data: {
              results: [
                { codigoOS: 1, placa: 'ABC-1234' },
                { codigoOS: 2, placa: 'DEF-5678' }
              ]
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: {
              results: [
                { codigoOS: 3, placa: 'GHI-9012' },
                { codigoOS: 4, placa: 'JKL-3456' }
              ]
            }
          }
        })
        .mockResolvedValueOnce({
          data: {
            data: {
              results: []
            }
          }
        });

      const results: any[] = [];
      const pageGenerator = apiClient.paginate('/os', 2);
      
      for await (const batch of pageGenerator) {
        results.push(...batch);
      }

      // Should have made 3 requests (2 with data, 1 empty)
      expect(mockInstance.get).toHaveBeenCalledTimes(3);
      
      // Check pagination parameters were sent
      expect(mockInstance.get).toHaveBeenNthCalledWith(1, 
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            pagina: 1,
            linhas: 2
          })
        })
      );
      
      expect(mockInstance.get).toHaveBeenNthCalledWith(2,
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            pagina: 2,
            linhas: 2
          })
        })
      );

      // Should have collected all records
      expect(results).toHaveLength(4);
      expect(results[0].codigoOS).toBe(1);
      expect(results[2].codigoOS).toBe(3);
      expect(results[3].codigoOS).toBe(4);
    });

    it('should handle large datasets with OS endpoint', async () => {
      const mockInstance = (mockedAxios as any).mockInstance;
      
      // Mock 10 pages of 100 records each
      for (let page = 1; page <= 10; page++) {
        const records = Array.from({ length: 100 }, (_, i) => ({
          codigoOS: (page - 1) * 100 + i + 1,
          placa: `TEST-${(page - 1) * 100 + i + 1}`
        }));
        
        mockInstance.get.mockResolvedValueOnce({
          data: { data: { results: records } }
        });
      }
      
      // Final empty page
      mockInstance.get.mockResolvedValueOnce({
        data: { data: { results: [] } }
      });

      const results: any[] = [];
      const pageGenerator = apiClient.paginate('/os', 100);
      
      for await (const batch of pageGenerator) {
        results.push(...batch);
      }

      expect(results).toHaveLength(1000);
      expect(results[0].codigoOS).toBe(1);
      expect(results[999].codigoOS).toBe(1000);
    });

    it('should stop pagination when receiving less than requested', async () => {
      const mockInstance = (mockedAxios as any).mockInstance;
      
      // Mock response with less records than requested
      mockInstance.get
        .mockResolvedValueOnce({
          data: {
            data: {
              results: [
                { codigoOS: 1, placa: 'ABC-1234' },
                { codigoOS: 2, placa: 'DEF-5678' },
                { codigoOS: 3, placa: 'GHI-9012' }
              ]
            }
          }
        });

      const results: any[] = [];
      const pageGenerator = apiClient.paginate('/os', 10); // Request 10, get 3
      
      for await (const batch of pageGenerator) {
        results.push(...batch);
      }

      // Should only make 1 request since we got less than requested
      expect(mockInstance.get).toHaveBeenCalledTimes(1);
      expect(results).toHaveLength(3);
    });
  });

  describe('direct get method with OS endpoint', () => {
    it('should support pagination parameters', async () => {
      const mockInstance = (mockedAxios as any).mockInstance;
      
      mockInstance.get.mockResolvedValueOnce({
        data: {
          data: {
            results: [
              { codigoOS: 101, placa: 'XYZ-1234' },
              { codigoOS: 102, placa: 'XYZ-5678' }
            ]
          }
        }
      });

      const response = await apiClient.get<{ results: any[] }>('/os', { pagina: 2, linhas: 50 });

      expect(mockInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/os'),
        expect.objectContaining({
          params: expect.objectContaining({
            pagina: 2,
            linhas: 50
          })
        })
      );

      expect(response.results).toHaveLength(2);
      expect(response.results[0].codigoOS).toBe(101);
    });
  });
});