import { OsSyncService } from '../../services/sync/os.sync';
import { ApiClient } from '../../services/api.client';
import { getConnection } from '../../config/database';
import logger from '../../utils/logger';

jest.mock('../../services/api.client');
jest.mock('../../config/database');
jest.mock('../../utils/logger');

describe('OsSyncService', () => {
  let osSyncService: OsSyncService;
  let mockApiClient: jest.Mocked<ApiClient>;
  let mockPool: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockApiClient = {
      get: jest.fn(),
      paginate: jest.fn(),
    } as any;
    
    (ApiClient.getInstance as jest.Mock).mockReturnValue(mockApiClient);
    
    mockPool = {
      execute: jest.fn(),
      getConnection: jest.fn(),
    };
    
    (getConnection as jest.Mock).mockResolvedValue(mockPool);
    
    osSyncService = new OsSyncService();
  });

  describe('sync', () => {
    it('should successfully sync OS records and items', async () => {
      // Mock paginated OS records
      const mockOsRecords = [
        {
          codigoOS: 1,
          codigoEmpresa: 100,
          codigoUnidade: 1,
          dataAbertura: '2024-01-01',
          placa: 'ABC-1234',
          codigoFornecedor: 10,
          numeroDocumento: 'DOC-001',
        },
        {
          codigoOS: 2,
          codigoEmpresa: 100,
          codigoUnidade: 1,
          dataAbertura: '2024-01-02',
          placa: 'DEF-5678',
          codigoFornecedor: 20,
          numeroDocumento: 'DOC-002',
        },
      ];

      // Mock OS details with items
      const mockOsDetails = [
        {
          ...mockOsRecords[0],
          itens: [
            { numeroItem: 1, valorItem: 100, quantidade: 2 },
            { numeroItem: 2, valorItem: 50, quantidade: 1 },
          ],
        },
        {
          ...mockOsRecords[1],
          itens: [
            { numeroItem: 1, valorItem: 200, quantidade: 1 },
          ],
        },
      ];

      // Mock pagination generator
      const mockPaginateGenerator = async function* () {
        yield mockOsRecords;
      };
      mockApiClient.paginate.mockReturnValue(mockPaginateGenerator());

      // Mock detail fetches
      mockApiClient.get
        .mockResolvedValueOnce(mockOsDetails[0])
        .mockResolvedValueOnce(mockOsDetails[1]);

      // Mock database operations
      mockPool.execute.mockResolvedValue([{ affectedRows: 2 }]);
      
      const mockConnection = {
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        execute: jest.fn().mockResolvedValue([{ affectedRows: 2 }]),
        release: jest.fn(),
      };
      mockPool.getConnection.mockResolvedValue(mockConnection);

      // Execute sync
      const result = await osSyncService.sync();

      // Verify results
      expect(result.success).toBe(true);
      expect(result.entity).toBe('os');
      expect(result.recordsSynced).toBeGreaterThan(0);
      
      // Verify API calls
      expect(mockApiClient.paginate).toHaveBeenCalledWith('/os', 200);
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      expect(mockApiClient.get).toHaveBeenCalledWith('/os/1');
      expect(mockApiClient.get).toHaveBeenCalledWith('/os/2');
      
      // Verify database operations
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
      // Mock API error
      const mockError = new Error('API Error');
      
      const mockPaginateGenerator = async function* () {
        throw mockError;
      };
      mockApiClient.paginate.mockReturnValue(mockPaginateGenerator());

      // Execute sync
      const result = await osSyncService.sync();

      // Verify error handling
      expect(result.success).toBe(false);
      expect(result.error).toBe('API Error');
      expect(result.recordsSynced).toBe(0);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalled();
    });

    it('should continue syncing if detail fetch fails for individual OS', async () => {
      // Mock OS records
      const mockOsRecords = [
        {
          codigoOS: 1,
          codigoEmpresa: 100,
          codigoUnidade: 1,
          dataAbertura: '2024-01-01',
          placa: 'ABC-1234',
          codigoFornecedor: 10,
          numeroDocumento: 'DOC-001',
          valorTotal: 500,
          quantidadeItens: 3,
        },
      ];

      // Mock pagination generator
      const mockPaginateGenerator = async function* () {
        yield mockOsRecords;
      };
      mockApiClient.paginate.mockReturnValue(mockPaginateGenerator());

      // Mock detail fetch failure
      mockApiClient.get.mockRejectedValueOnce(new Error('Detail fetch failed'));

      // Mock database operations
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);
      
      const mockConnection = {
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        release: jest.fn(),
      };
      mockPool.getConnection.mockResolvedValue(mockConnection);

      // Execute sync
      const result = await osSyncService.sync();

      // Verify results - should still succeed with basic OS data
      expect(result.success).toBe(true);
      expect(result.recordsSynced).toBe(1);
      
      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch details for OS 1'),
        expect.any(Error)
      );
    });

    it('should calculate total values correctly from items', async () => {
      // Mock OS record
      const mockOsRecord = {
        codigoOS: 1,
        codigoEmpresa: 100,
        codigoUnidade: 1,
        dataAbertura: '2024-01-01',
        placa: 'ABC-1234',
        codigoFornecedor: 10,
        numeroDocumento: 'DOC-001',
      };

      // Mock OS detail with items
      const mockOsDetail = {
        ...mockOsRecord,
        itens: [
          { numeroItem: 1, valorItem: 100, quantidade: 2 }, // 200
          { numeroItem: 2, valorItem: 50, quantidade: 3 },  // 150
          { numeroItem: 3, valorItem: 25, quantidade: 4 },  // 100
        ],
      };

      // Mock pagination generator
      const mockPaginateGenerator = async function* () {
        yield [mockOsRecord];
      };
      mockApiClient.paginate.mockReturnValue(mockPaginateGenerator());

      // Mock detail fetch
      mockApiClient.get.mockResolvedValueOnce(mockOsDetail);

      // Mock database operations
      const mockConnection = {
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        execute: jest.fn(),
        release: jest.fn(),
      };
      
      // Capture the data being inserted
      let insertedOsData: any;
      mockConnection.execute.mockImplementation((sql: string, values: any[]) => {
        // Only capture data from the main OS table insert, not os_itens
        if (sql.includes('INSERT INTO os ') && !sql.includes('INSERT INTO os_itens')) {
          // The values array contains all values for the batch insert
          // Since we're inserting one record with 9 columns, extract the correct indices
          insertedOsData = {
            codigo_os: values[0],
            valor_total: values[7], // valor_total is at index 7
            quantidade_itens: values[8], // quantidade_itens is at index 8
          };
        }
        return Promise.resolve([{ affectedRows: 1 }]);
      });
      
      mockPool.getConnection.mockResolvedValue(mockConnection);
      mockPool.execute.mockResolvedValue([{ affectedRows: 1 }]);

      // Execute sync
      await osSyncService.sync();

      // Verify calculated values
      expect(insertedOsData.valor_total).toBe(450); // 200 + 150 + 100
      expect(insertedOsData.quantidade_itens).toBe(3);
    });

    it('should update vehicle expenses after syncing', async () => {
      // Mock OS record
      const mockOsRecords = [
        {
          codigoOS: 1,
          codigoEmpresa: 100,
          codigoUnidade: 1,
          dataAbertura: '2024-01-01',
          placa: 'ABC-1234',
          codigoFornecedor: 10,
          numeroDocumento: 'DOC-001',
        },
      ];

      // Mock pagination generator
      const mockPaginateGenerator = async function* () {
        yield mockOsRecords;
      };
      mockApiClient.paginate.mockReturnValue(mockPaginateGenerator());

      // Mock detail fetch
      mockApiClient.get.mockResolvedValueOnce({
        ...mockOsRecords[0],
        itens: [{ numeroItem: 1, valorItem: 100, quantidade: 1 }],
      });

      // Mock database operations
      const mockConnection = {
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        execute: jest.fn().mockResolvedValue([{ affectedRows: 1 }]),
        release: jest.fn(),
      };
      mockPool.getConnection.mockResolvedValue(mockConnection);
      
      // Mock the vehicle expenses update query
      let vehicleExpensesUpdated = false;
      mockPool.execute.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO bi_vehicle_expenses')) {
          vehicleExpensesUpdated = true;
        }
        return Promise.resolve([{ affectedRows: 1 }]);
      });

      // Execute sync
      const result = await osSyncService.sync();

      // Verify vehicle expenses were updated
      expect(vehicleExpensesUpdated).toBe(true);
      expect(result.success).toBe(true);
    });
  });
});