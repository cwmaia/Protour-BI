import dotenv from 'dotenv';

dotenv.config();

export const apiConfig = {
  baseUrl: process.env.API_BASE_URL || 'https://apilocavia.infosistemas.com.br:3049/v1',
  credentials: {
    cnpj: process.env.API_CNPJ || '12801601000182',
    username: process.env.API_USERNAME || 'BI',
    password: process.env.API_PASSWORD || 'BI2025'
  },
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '100'),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '1000')
  },
  tokenRefreshHours: parseInt(process.env.TOKEN_REFRESH_HOURS || '20'),
  requestTimeout: 60000, // 60 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second base delay for exponential backoff
};