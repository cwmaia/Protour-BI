import winston from 'winston';
import path from 'path';

const logDir = 'logs';

// Create transports based on environment
const transports: winston.transport[] = [];

// Always add file transports unless explicitly disabled
if (process.env.LOG_FILE_ONLY !== 'false') {
  transports.push(
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

// Add console transport only if not silent and not in production
if (process.env.LOG_SILENT !== 'true' && 
    process.env.LOG_FILE_ONLY !== 'true' &&
    process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  silent: process.env.LOG_SILENT === 'true',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'locavia-sync' },
  transports
});

export default logger;