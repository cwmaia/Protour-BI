import { ApiClient } from '../../services/api.client';
import axios from 'axios';

jest.mock('axios');

describe('ApiClient', () => {
  let apiClient: ApiClient;
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    jest.clearAllMocks();
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
    
    apiClient = new ApiClient();
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.stringContaining('apilocavia.infosistemas.com.br'),
        timeout: expect.any(Number),
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
    });
  });

  // Add more tests as needed
});