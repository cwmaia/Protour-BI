import { ApiClient } from '../../services/api.client';
import axios from 'axios';

jest.mock('axios');

describe('ApiClient', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the singleton instance
    (ApiClient as any).instance = null;
    
    mockedAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      put: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() }
      }
    } as any);
  });

  describe('getInstance', () => {
    it('should create axios instance with correct config', () => {
      ApiClient.getInstance();
      
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.stringContaining('apilocavia.infosistemas.com.br'),
        timeout: expect.any(Number),
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });
    
    it('should return the same instance on multiple calls', () => {
      const instance1 = ApiClient.getInstance();
      const instance2 = ApiClient.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(mockedAxios.create).toHaveBeenCalledTimes(1);
    });
  });

  // Add more tests as needed
});